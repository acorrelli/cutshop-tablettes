// Format des questions de quiz : [question, [bonne réponse, trois mauvaises réponses]].
export type QA = [string, [string, string, string, string]];

/** Une question en français puis sa traduction anglaise, propositions dans le même ordre. */
export type QuizPair = [QA, QA];
