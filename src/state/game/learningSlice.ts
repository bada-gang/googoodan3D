/** 학습 기록: 문제별 · 단별 정답률, 오답 복습 줄, 최근에 낸 문제. */
import { RECENT_MEMORY, WRONG_REVIEW_MAX_GAP } from '@/config/balance';
import type { LearningStats, MathQuestion } from '@/types/learning';
import { createEmptyLearningStats, problemKey } from '@/types/learning';
import type { GameSlice } from './types';

export interface LearningSlice {
  stats: LearningStats;
  /** 최근 출제된 문제 키 (앞이 최신) */
  recentQuestions: string[];
  /** 문제를 푼 횟수 — 오답 복습 간격 계산용 */
  questionCounter: number;

  recordAttempt: (question: MathQuestion, isCorrect: boolean) => void;
  noteQuestionAsked: (question: MathQuestion) => void;
}

export const createLearningSlice: GameSlice<LearningSlice> = (set, get) => ({
  stats: createEmptyLearningStats(),
  recentQuestions: [],
  questionCounter: 0,

  noteQuestionAsked: (question) =>
    set((s) => ({
      recentQuestions: [problemKey(question.left, question.right), ...s.recentQuestions].slice(
        0,
        RECENT_MEMORY * 2,
      ),
      questionCounter: s.questionCounter + 1,
    })),

  recordAttempt: (question, isCorrect) => {
    const profile = get().profile;
    if (!profile) return;
    const key = problemKey(question.left, question.right);
    const now = new Date().toISOString();

    set((s) => {
      const stats = s.stats;
      const prev = stats.byProblem[key] ?? {
        key,
        left: question.left,
        right: question.right,
        attempts: 0,
        correct: 0,
        streak: 0,
        lastAttemptedAt: null,
      };
      const record = {
        ...prev,
        attempts: prev.attempts + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
        streak: isCorrect ? prev.streak + 1 : 0,
        lastAttemptedAt: now,
      };

      const table = stats.byTable[question.table] ?? { attempts: 0, correct: 0 };
      const wrongQueue = isCorrect
        ? stats.wrongQueue.filter((k) => k !== key)
        : [key, ...stats.wrongQueue.filter((k) => k !== key)].slice(0, WRONG_REVIEW_MAX_GAP);

      return {
        stats: {
          totalAttempts: stats.totalAttempts + 1,
          totalCorrect: stats.totalCorrect + (isCorrect ? 1 : 0),
          totalWrong: stats.totalWrong + (isCorrect ? 0 : 1),
          byTable: {
            ...stats.byTable,
            [question.table]: {
              attempts: table.attempts + 1,
              correct: table.correct + (isCorrect ? 1 : 0),
            },
          },
          byProblem: { ...stats.byProblem, [key]: record },
          wrongQueue,
        },
      };
    });
  },
});
