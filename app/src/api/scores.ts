// Scores are now fetched reactively via Convex hooks in components:
//   const scores = useQuery(api.scores.getScores)
//
// For imperative calls from Zustand stores, use convex.mutation directly.
// See src/stores/gameData.ts -> submitFinalScore.
export {};
