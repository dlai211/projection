# pip install qrcode[pil]
import qrcode
u = "https://dlai211.github.io/projection/blackhole_poster/index.html"
img = qrcode.make(u)
img.save("qr_universe_on_tap.png")
