/**
 * Getting sound into the analyser.
 *
 * Two sources, one path — which is the point: the detector is fed exactly the same
 * signal whether it comes from a microphone in front of a real piano or from the test
 * recording, so what is proved with the recording holds for the microphone.
 *
 *   microphone ─┐
 *               ├─→ AnalyserNode (FFT 4096) ─→ the detector
 *   test mp3  ──┘
 *
 * The microphone is deliberately *not* connected to the speakers: a microphone played
 * back through the same room howls. The test recording is, because you want to hear it.
 */
window.App = window.App || {};

window.App.AudioEngine = (function () {
  'use strict';

  const Config = window.App.Config;

  let context = null;
  let analyser = null;
  let spectrum = null;
  let microphone = null;        // the MediaStream
  let microphoneNode = null;
  let element = null;           // the <audio> used for the test recording
  let elementNode = null;
  let mode = 'idle';            // 'idle' | 'microphone' | 'test'
  let lastError = '';

  /** The audio context and analyser, created on the first real use. */
  function ensure() {
    if (!context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      context = new Context();
      analyser = context.createAnalyser();
      analyser.fftSize = Config.audio.fftSize;
      analyser.smoothingTimeConstant = Config.audio.smoothing;
      spectrum = new Float32Array(analyser.frequencyBinCount);
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  /** The spectrum right now: decibels per bin, and how wide a bin is. */
  function read() {
    if (!analyser) return null;
    analyser.getFloatFrequencyData(spectrum);
    return { decibels: spectrum, binHz: context.sampleRate / analyser.fftSize };
  }

  function isListening() {
    return mode !== 'idle' && !!analyser;
  }

  function currentMode() {
    return mode;
  }

  function lastMessage() {
    return lastError;
  }

  // ------------------------------------------------------------- microphone

  function startMicrophone() {
    if (mode === 'microphone') return Promise.resolve(true);
    stopTestAudio();
    ensure();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      lastError = 'This browser will not give the page a microphone.';
      return Promise.resolve(false);
    }

    // The three constraints matter: leave any of them on and the browser "cleans up"
    // the piano's overtones before the detector ever sees them.
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then(function (stream) {
      microphone = stream;
      microphoneNode = context.createMediaStreamSource(stream);
      microphoneNode.connect(analyser);          // analysed, never played back
      mode = 'microphone';
      lastError = '';
      return true;
    }).catch(function (error) {
      lastError = 'The microphone was refused (' + (error && error.name ? error.name : 'error') + ').';
      mode = 'idle';
      return false;
    });
  }

  function stopMicrophone() {
    if (microphoneNode) {
      microphoneNode.disconnect();
      microphoneNode = null;
    }
    if (microphone) {
      microphone.getTracks().forEach(function (track) { track.stop(); });
      microphone = null;
    }
    if (mode === 'microphone') mode = 'idle';
  }

  // ------------------------------------------------------------- test audio

  /** Wire the test recording into the analyser, so it can be heard and detected. */
  function useTestAudio(url) {
    ensure();
    if (element) return element;

    element = new Audio();
    element.src = url;
    element.loop = false;
    element.crossOrigin = 'anonymous';
    elementNode = context.createMediaElementSource(element);
    // The recording goes to the analyser *and* to the speakers, in parallel.
    // It must not go speakers-ward *through* the analyser: that connection would still
    // be there when the microphone is switched on, and the microphone would howl.
    elementNode.connect(analyser);
    elementNode.connect(context.destination);
    return element;
  }

  function playTestAudio() {
    if (mode === 'microphone') stopMicrophone();
    if (!element) return Promise.resolve(false);
    mode = 'test';
    return element.play().then(function () { return true; }).catch(function (error) {
      mode = 'idle';
      lastError = window.location.protocol === 'file:'
        ? 'The test recording only plays over http://localhost — open the page from the local server.'
        : 'The test recording would not play (' + (error && error.name ? error.name : 'error') + ').';
      return false;
    });
  }

  function pauseTestAudio() {
    if (element) element.pause();
    if (mode === 'test') mode = 'idle';
  }

  function stopTestAudio() {
    if (element) {
      element.pause();
      element.currentTime = 0;
    }
    if (mode === 'test') mode = 'idle';
  }

  function testElement() {
    return element;
  }

  /** Silence everything and let the microphone go. */
  function stopAll() {
    stopMicrophone();
    stopTestAudio();
    mode = 'idle';
  }

  return {
    ensure: ensure,
    read: read,
    context: function () { return context; },
    analyser: function () { return analyser; },
    isListening: isListening,
    currentMode: currentMode,
    lastMessage: lastMessage,
    startMicrophone: startMicrophone,
    stopMicrophone: stopMicrophone,
    useTestAudio: useTestAudio,
    playTestAudio: playTestAudio,
    pauseTestAudio: pauseTestAudio,
    stopTestAudio: stopTestAudio,
    testElement: testElement,
    stopAll: stopAll
  };
})();
