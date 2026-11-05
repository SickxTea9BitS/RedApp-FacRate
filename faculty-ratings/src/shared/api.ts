export type FacultyRecord = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  school: string;
  createdAt: number;
};

export type FacultyRequest = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  school: string;
  createdAt: number;
  submittedByUsername: string;
  submittedByUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  customReason?: string;
  reviewedAt?: number;
  reviewedByUsername?: string;
};

export type FacultyApprovalInput = {
  firstName: string;
  middleName: string;
  lastName: string;
  school: string;
};

export type FacultyListResponse = {
  status: 'success';
  faculty: FacultyRecord[];
  total: number;
};

export type ApiErrorResponse = {
  status: 'error';
  message: string;
};

export type FacultyRequestSubmissionResponse =
  | {
      status: 'success';
      message: string;
      requestId: string;
    }
  | ApiErrorResponse;

export type ModeratorStatusResponse = {
  status: 'success';
  isModerator: boolean;
};

export type ModeratorRequestsResponse = {
  status: 'success';
  requests: FacultyRequest[];
  total: number;
};

export type ModerationActionResponse =
  | {
      status: 'success';
      message: string;
    }
  | ApiErrorResponse;

export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type FacultyRatingValues = {
  teaching: number;
  internalMarking: number;
  examEvaluation: number;
  overallRecommendation: number;
};

export type FacultyRatingSummary = {
  status: 'success';
  count: number;
  averages: FacultyRatingValues;
  eligibility: {
    loggedIn: boolean;
    eligible: boolean;
    accountAgeDays: number | null;
    totalKarma: number | null;
    hasRated: boolean;
    reason: string;
  };
};

export type FacultyRatingSubmissionResponse =
  | { status: 'success'; message: string }
  | ApiErrorResponse;
