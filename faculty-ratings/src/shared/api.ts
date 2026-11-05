export type FacultyRecord = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  school: string;
  courseCodes?: string[];
  createdAt: number;
  ratingCount?: number;
  hasRated?: boolean;
};

export type FacultyRequest = {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  school: string;
  courseCodes?: string[];
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
  courseCodes: string[];
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
  classAverage: number;
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


export type CourseRecord = {
  id: string;
  code: string;
  createdAt: number;
  createdByUsername: string;
  approvedAt?: number;
  approvedByUsername?: string;
};

export type CourseRequest = {
  id: string;
  code: string;
  createdAt: number;
  submittedByUsername: string;
  submittedByUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  customReason?: string;
  reviewedAt?: number;
  reviewedByUsername?: string;
};

export type CourseListResponse = {
  status: 'success';
  courses: CourseRecord[];
  total: number;
};

export type CourseRequestSubmissionResponse =
  | { status: 'success'; message: string; requestId: string }
  | ApiErrorResponse;

export type ModeratorCourseRequestsResponse = {
  status: 'success';
  requests: CourseRequest[];
  total: number;
};
