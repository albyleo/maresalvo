export const ZONE_STYLES: Record<string, { color: string; title: string; description: string }> = {
  A: { color: '#fb7185', title: 'Riserva integrale', description: 'Tutela più rigorosa. Pesca vietata; accessi e attività limitati alle eccezioni previste dal regolamento.' },
  B: { color: '#fbbf24', title: 'Riserva generale', description: 'Attività regolamentate. Navigazione, immersioni e pesca possono richiedere autorizzazioni e avere limiti specifici.' },
  Bs: { color: '#fb923c', title: 'Riserva generale speciale', description: 'Sottozona con prescrizioni specifiche: consultare il regolamento dell’area.' },
  C: { color: '#34d399', title: 'Riserva parziale', description: 'Attività compatibili con la tutela, soggette al regolamento. Il colore verde non indica pesca libera.' },
  D: { color: '#a78bfa', title: 'Regime specifico', description: 'Zona presente in alcune cartografie regionali; condizioni definite dal relativo decreto.' },
};
