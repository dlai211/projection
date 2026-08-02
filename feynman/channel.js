function s_channel(){
  const w = 700;
  const h = 400;

  // Shift everything right to center the diagram
  const offsetX = w * 0.08;        // shift right by ~56px to center
  const leftX = w * 0.114 + offsetX;        // ≈136
  const vertexX = w * 0.314 + offsetX;      // ≈276
  const rightX = w * 0.571 + offsetX;       // ≈456
  const topY = h * 0.3;           // ≈120
  const centerY = h * 0.5;        // ≈200
  const bottomY = h * 0.7;        // ≈280
  const upperOutY = h * 0.3;      // ≈120
  const lowerOutY = h * 0.7;      // ≈280
  const outX = w * 0.786 + offsetX;         // ≈606

  drawFermion(leftX, topY, vertexX, centerY, 'e⁻', false, true);
  drawFermion(leftX, bottomY, vertexX, centerY, 'e⁺', true, true);
  drawBoson(vertexX, centerY, rightX, centerY, 'γ/Z');
  drawFermion(rightX, centerY, outX, upperOutY, 'μ⁻', false, false);
  drawFermion(rightX, centerY, outX, lowerOutY, 'μ⁺', true, false);
}

function t_channel(){
  const w = 700;
  const h = 400;

  // Center-based coordinates
  const offsetX = w * 0.08;
  const leftX = w * 0.114 + offsetX;
  const rightX = w * 0.786 + offsetX;
  const topY = h * 0.25;
  const upperMidY = h * 0.38;
  const lowerMidY = h * 0.62;
  const bottomY = h * 0.75;

  // Top incoming to top outgoing (scattered forward)
  drawFermion(leftX, topY, leftX + w * 0.15, upperMidY, 'e⁻', false, true);
  drawFermion(leftX + w * 0.15, upperMidY, rightX, topY, 'e⁻', false, false);
  
  // Bottom incoming to bottom outgoing
  drawFermion(leftX, bottomY, leftX + w * 0.15, lowerMidY, 'e⁻', false, true);
  drawFermion(leftX + w * 0.15, lowerMidY, rightX, bottomY, 'e⁻', false, false);
  
  // Mediator (vertical exchange)
  drawBoson(leftX + w * 0.15, upperMidY, leftX + w * 0.15, lowerMidY, 'γ');
}

function u_channel(){
  const w = 700;
  const h = 400;

  // Center-based coordinates
  const offsetX = w * 0.08;
  const leftX = w * 0.114 + offsetX;
  const rightX = w * 0.786 + offsetX;
  const topY = h * 0.25;
  const upperMidY = h * 0.38;
  const lowerMidY = h * 0.62;
  const bottomY = h * 0.75;

  // Top incoming to bottom outgoing (crossed)
  drawFermion(leftX, topY, leftX + w * 0.15, upperMidY, 'e⁻', false, true);
  drawFermion(leftX + w * 0.15, upperMidY, rightX, bottomY, 'e⁻', false, false);
  
  // Bottom incoming to top outgoing (crossed)
  drawFermion(leftX, bottomY, leftX + w * 0.15, lowerMidY, 'e⁻', false, true);
  drawFermion(leftX + w * 0.15, lowerMidY, rightX, topY, 'e⁻', false, false);
  
  // Mediator (vertical exchange)
  drawBoson(leftX + w * 0.15, upperMidY, leftX + w * 0.15, lowerMidY, 'γ');
}