// Web Worker del análisis: analiza una mano por mensaje sin trabar la pantalla.
// Entrada: { id, hand, seats, seed }. Salida: { id, results } o { id, error }.
import { analyzeHand } from './analysis.js';

self.onmessage = (e) => {
  const { id, hand, seats, seed } = e.data;
  try {
    self.postMessage({ id, results: analyzeHand(hand, seats, seed) });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
