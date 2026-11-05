import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  FacultyListResponse,
  FacultyRecord,
  FacultyRequest,
  FacultyRequestSubmissionResponse,
  CourseRecord,
  CourseListResponse,
  FacultyRatingSummary,
  FacultyRatingValues,
  ModerationActionResponse,
  ModeratorRequestsResponse,
  ModeratorStatusResponse,
  CourseRequest,
  FacultyCourseTagRequest,
  CourseRequestSubmissionResponse,
  ModeratorCourseRequestsResponse,
} from '../shared/api';
import './index.css';

const SCHOOLS = [
  'SASL',
  'SBET',
  'SCOPE',
  'SCAI',
  'SMEC',
  'BS',
  'SEEE',
  'SA',
];

const REJECTION_REASONS = [
  'Duplicate Request',
  'Already Exists',
  'Invalid',
  'Custom',
];

type View = 'home' | 'faculty' | 'faculty-detail' | 'request' | 'course-request' | 'admin';
type RatingMode = 'check';

const styles = {
  page: {
    backgroundColor: '#1a1a1b',
    color: '#ffffff',
    minHeight: '100vh',
    padding: '28px 20px',
    fontFamily: 'sans-serif',
    boxSizing: 'border-box' as const,
  },
  container: {
    width: '100%',
    maxWidth: '720px',
    margin: '0 auto',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#aaa',
    marginBottom: '28px',
    lineHeight: 1.5,
  },
  button: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0079D3',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '11px 20px',
    borderRadius: '8px',
    border: '1px solid #0079D3',
    backgroundColor: 'transparent',
    color: '#38aaff',
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '13px',
    borderRadius: '8px',
    border: '1px solid #444',
    backgroundColor: '#252526',
    color: 'white',
    fontSize: '1rem',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  card: {
    backgroundColor: '#252526',
    border: '1px solid #383838',
    borderRadius: '10px',
    padding: '16px',
    textAlign: 'left' as const,
    color: 'white',
    width: '100%',
  },
  muted: {
    color: '#999',
    fontSize: '0.9rem',
  },
  label: {
    display: 'block',
    marginBottom: '7px',
    color: '#ddd',
    fontSize: '0.95rem',
    fontWeight: 'bold' as const,
  },
};

const getFullName = (record: {
  firstName: string;
  middleName?: string;
  lastName: string;
}) =>
  [record.firstName, record.middleName, record.lastName]
    .filter(Boolean)
    .join(' ');

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString();

export const App = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const [ratingMode, setRatingMode] = useState<RatingMode>('check');
  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [faculty, setFaculty] = useState<FacultyRecord[]>([]);
  const [selectedFaculty, setSelectedFaculty] =
    useState<FacultyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [requestSchool, setRequestSchool] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [availableCourses, setAvailableCourses] = useState<CourseRecord[]>([]);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseOptionsLoading, setCourseOptionsLoading] = useState(false);
  const [courseOptionsError, setCourseOptionsError] = useState('');


  const [isModerator, setIsModerator] = useState(false);
  const [moderatorCheckLoading, setModeratorCheckLoading] = useState(true);
  const [moderatorRequests, setModeratorRequests] = useState<FacultyRequest[]>(
    []
  );
  const [moderatorLoading, setModeratorLoading] = useState(false);
  const [moderatorError, setModeratorError] = useState('');
  const [moderatorMessage, setModeratorMessage] = useState('');
  const [activeRejectId, setActiveRejectId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [moderationBusyId, setModerationBusyId] = useState('');
  const [activeApproveRequest, setActiveApproveRequest] =
    useState<FacultyRequest | null>(null);
  const [approvalFirstName, setApprovalFirstName] = useState('');
  const [approvalMiddleName, setApprovalMiddleName] = useState('');
  const [approvalLastName, setApprovalLastName] = useState('');
  const [approvalSchool, setApprovalSchool] = useState('');
  const [approvalCourseCodes, setApprovalCourseCodes] = useState<string[]>([]);
  const [approvalCourseSearch, setApprovalCourseSearch] = useState('');

  const [allFacultyForModeration, setAllFacultyForModeration] = useState<FacultyRecord[]>([]);
  const [facultyManagementLoading, setFacultyManagementLoading] = useState(false);
  const [facultyManagementError, setFacultyManagementError] = useState('');
  const [editingFacultyId, setEditingFacultyId] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editMiddleName, setEditMiddleName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editCourseCodes, setEditCourseCodes] = useState<string[]>([]);
  const [editCourseSearch, setEditCourseSearch] = useState('');
  const [facultyEditBusy, setFacultyEditBusy] = useState(false);
  const [facultyEditMessage, setFacultyEditMessage] = useState('');
  const [adminSection, setAdminSection] = useState<'menu' | 'faculty-requests' | 'course-requests' | 'faculties'>('menu');
  const [facultyAdminSearch, setFacultyAdminSearch] = useState('');
  const [facultyCourseRequestCodes, setFacultyCourseRequestCodes] = useState<string[]>([]);
  const [facultyCourseRequestSearch, setFacultyCourseRequestSearch] = useState('');
  const [facultyCourseRequestMessage, setFacultyCourseRequestMessage] = useState('');
  const [facultyCourseRequestError, setFacultyCourseRequestError] = useState('');
  const [facultyCourseRequestBusy, setFacultyCourseRequestBusy] = useState(false);
  const [showFacultyCourseRequestEditor, setShowFacultyCourseRequestEditor] = useState(false);
  const [moderatorFacultyCourseRequests, setModeratorFacultyCourseRequests] = useState<FacultyCourseTagRequest[]>([]);
  const [moderatorFacultyCourseSelection, setModeratorFacultyCourseSelection] = useState<Record<string, string[]>>({});

  const [ratingSummary, setRatingSummary] = useState<FacultyRatingSummary | null>(null);
  const [ratingValues, setRatingValues] = useState<FacultyRatingValues>({
    teaching: 50,
    internalMarking: 50,
    examEvaluation: 50,
    overallRecommendation: 50,
    classAverage: 50,
  });
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [ratingMessage, setRatingMessage] = useState('');

  const [courseCode, setCourseCode] = useState('');
  const [courseRequestLoading, setCourseRequestLoading] = useState(false);
  const [courseRequestError, setCourseRequestError] = useState('');
  const [courseRequestSuccess, setCourseRequestSuccess] = useState('');
  const [moderatorCourseRequests, setModeratorCourseRequests] = useState<CourseRequest[]>([]);
  const [courseModerationLoading, setCourseModerationLoading] = useState(false);
  const [courseModerationError, setCourseModerationError] = useState('');
  const [courseModerationMessage, setCourseModerationMessage] = useState('');
  const [courseModerationBusyId, setCourseModerationBusyId] = useState('');
  const [courseRejectId, setCourseRejectId] = useState('');
  const [courseRejectReason, setCourseRejectReason] = useState('');
  const [courseCustomReason, setCourseCustomReason] = useState('');




  useEffect(() => {
    let active = true;

    const checkModerator = async () => {
      try {
        const response = await fetch('/api/mod/status');

        if (!response.ok) {
          throw new Error('Unable to verify moderator permissions.');
        }

        const result = (await response.json()) as ModeratorStatusResponse;

        if (active && result.status === 'success') {
          setIsModerator(result.isModerator);
        }
      } catch {
        if (active) {
          setIsModerator(false);
        }
      } finally {
        if (active) {
          setModeratorCheckLoading(false);
        }
      }
    };

    void checkModerator();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (currentView !== 'faculty') {
      return;
    }

    let active = true;

    const loadFaculty = async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();

        if (search.trim()) {
          params.set('search', search.trim());
        }

        if (selectedSchool) {
          params.set('school', selectedSchool);
        }
        if (selectedCourse) {
          params.set('course', selectedCourse);
        }

        const response = await fetch(`/api/faculty?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Unable to retrieve faculty records.');
        }

        const result = (await response.json()) as FacultyListResponse;

        if (result.status !== 'success') {
          throw new Error('Unexpected response from the server.');
        }

        if (active) {
          setFaculty(result.faculty);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Something went wrong while loading faculty.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadFaculty();

    return () => {
      active = false;
    };
  }, [currentView, search, selectedSchool, selectedCourse]);


  useEffect(() => {
    if (currentView !== 'faculty-detail' || !selectedFaculty) return;
    let active = true;
    const loadRatings = async () => {
      setRatingLoading(true);
      setRatingError('');
      setRatingMessage('');
      try {
        const response = await fetch(`/api/faculty/${encodeURIComponent(selectedFaculty.id)}/ratings`);
        const result = (await response.json()) as FacultyRatingSummary | { status: 'error'; message: string };
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.status === 'error' ? result.message : 'Unable to load ratings.');
        }
        if (active) setRatingSummary(result);
      } catch (error) {
        if (active) setRatingError(error instanceof Error ? error.message : 'Unable to load ratings.');
      } finally {
        if (active) setRatingLoading(false);
      }
    };
    void loadRatings();
    return () => { active = false; };
  }, [currentView, selectedFaculty]);

  const submitFacultyRating = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFaculty) return;
    setRatingSubmitting(true);
    setRatingError('');
    setRatingMessage('');
    try {
      const response = await fetch(
        `/api/faculty/${encodeURIComponent(selectedFaculty.id)}/ratings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ratingValues),
        }
      );
      const result = (await response.json()) as { status: 'success' | 'error'; message: string };
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Unable to submit your rating.');
      }
      setRatingMessage(result.message);
      const summaryResponse = await fetch(`/api/faculty/${encodeURIComponent(selectedFaculty.id)}/ratings`);
      const summary = (await summaryResponse.json()) as FacultyRatingSummary;
      if (summaryResponse.ok && summary.status === 'success') setRatingSummary(summary);
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : 'Unable to submit your rating.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const ratingLabels: { key: keyof FacultyRatingValues; label: string }[] = [
    { key: 'teaching', label: 'Teaching' },
    { key: 'internalMarking', label: 'Internal Marking' },
    { key: 'examEvaluation', label: 'Exam Evaluation' },
    { key: 'classAverage', label: 'Class Average' },
    { key: 'overallRecommendation', label: 'Overall Recommendation' },
  ];

  const openFacultyList = (mode: RatingMode) => {
    setRatingMode(mode);
    setSearch('');
    setSelectedSchool('');
    setSelectedCourse('');
    setSelectedFaculty(null);
    void loadAvailableCourses();
    setCurrentView('faculty');
  };


  const openCourseRequestForm = () => {
    setCourseCode('');
    setCourseRequestError('');
    setCourseRequestSuccess('');
    setCurrentView('course-request');
  };


  const loadModeratorFacultyCourseRequests = async () => {
    try {
      const response = await fetch('/api/mod/faculty-course-requests');
      const result = await response.json() as { status: 'success'; requests: FacultyCourseTagRequest[] } | ApiErrorResponse;
      if (!response.ok || result.status !== 'success') throw new Error(result.status === 'error' ? result.message : 'Unable to load faculty course requests.');
      setModeratorFacultyCourseRequests(result.requests);
      setModeratorFacultyCourseSelection((current) => {
        const next = { ...current };
        for (const request of result.requests) if (!next[request.id]) next[request.id] = [...request.courseCodes];
        return next;
      });
    } catch (error) {
      setCourseModerationError(error instanceof Error ? error.message : 'Unable to load faculty course requests.');
    }
  };

  const submitFacultyCourseTagRequest = async () => {
    if (!selectedFaculty || facultyCourseRequestCodes.length === 0) return;
    setFacultyCourseRequestBusy(true);
    setFacultyCourseRequestError('');
    setFacultyCourseRequestMessage('');
    try {
      const response = await fetch('/api/faculty/' + encodeURIComponent(selectedFaculty.id) + '/course-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseCodes: facultyCourseRequestCodes }),
      });
      const result = await response.json() as { status: 'success'; message: string } | ApiErrorResponse;
      if (!response.ok || result.status !== 'success') throw new Error(result.status === 'error' ? result.message : 'Unable to submit request.');
      setFacultyCourseRequestMessage(result.message);
      setFacultyCourseRequestCodes([]);
      setFacultyCourseRequestSearch('');
      setShowFacultyCourseRequestEditor(false);
    } catch (error) {
      setFacultyCourseRequestError(error instanceof Error ? error.message : 'Unable to submit request.');
    } finally { setFacultyCourseRequestBusy(false); }
  };

  const moderateFacultyCourseTagRequest = async (request: FacultyCourseTagRequest, approve: boolean) => {
    const selected = moderatorFacultyCourseSelection[request.id] ?? [];
    try {
      const response = await fetch('/api/mod/faculty-course-requests/' + encodeURIComponent(request.id) + (approve ? '/approve' : '/reject'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        ...(approve ? { body: JSON.stringify({ courseCodes: selected }) } : {}),
      });
      const result = await response.json() as ModerationActionResponse;
      if (!response.ok || result.status !== 'success') throw new Error(result.status === 'error' ? result.message : 'Unable to process request.');
      setCourseModerationMessage(result.message);
      await loadModeratorFacultyCourseRequests();
      await loadModeratorCourseRequests();
    } catch (error) {
      setCourseModerationError(error instanceof Error ? error.message : 'Unable to process request.');
    }
  };

  const loadModeratorCourseRequests = async () => {
    setCourseModerationLoading(true);
    setCourseModerationError('');
    try {
      const response = await fetch('/api/mod/course-requests');
      const result = (await response.json()) as ModeratorCourseRequestsResponse | { status: 'error'; message: string };
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.status === 'error' ? result.message : 'Unable to load course requests.');
      }
      setModeratorCourseRequests(result.requests);
    } catch (error) {
      setCourseModerationError(error instanceof Error ? error.message : 'Unable to load course requests.');
    } finally {
      setCourseModerationLoading(false);
    }
  };

  const submitCourseRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCourseRequestError('');
    setCourseRequestSuccess('');
    const normalizedCode = courseCode.trim().toUpperCase();
    if (!/^[A-Z]{3}[0-9]{4}$/.test(normalizedCode)) {
      setCourseRequestError('Enter a valid course code: three letters followed by four digits (for example, MAT1001).');
      return;
    }
    setCourseRequestLoading(true);
    try {
      const response = await fetch('/api/course-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const result = (await response.json()) as CourseRequestSubmissionResponse;
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.status === 'error' ? result.message : 'Unable to submit course request.');
      }
      setCourseRequestSuccess(result.message);
      setCourseCode('');
    } catch (error) {
      setCourseRequestError(error instanceof Error ? error.message : 'Unable to submit course request.');
    } finally {
      setCourseRequestLoading(false);
    }
  };

  const moderateCourseRequest = async (request: CourseRequest, action: 'approve' | 'reject') => {
    setCourseModerationBusyId(request.id);
    setCourseModerationError('');
    setCourseModerationMessage('');
    try {
      const response = await fetch(`/api/mod/course-requests/${encodeURIComponent(request.id)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(action === 'reject'
          ? { body: JSON.stringify({ reason: courseRejectReason, customReason: courseCustomReason }) }
          : {}),
      });
      const result = (await response.json()) as ModerationActionResponse;
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.status === 'error' ? result.message : 'Unable to process course request.');
      }
      setCourseModerationMessage(result.message);
      setCourseRejectId('');
      setCourseRejectReason('');
      setCourseCustomReason('');
      await loadModeratorCourseRequests();
    } catch (error) {
      setCourseModerationError(error instanceof Error ? error.message : 'Unable to process course request.');
    } finally {
      setCourseModerationBusyId('');
    }
  };

  const loadAvailableCourses = async () => {
    setCourseOptionsLoading(true);
    setCourseOptionsError('');
    try {
      const response = await fetch('/api/courses');
      const result = (await response.json()) as CourseListResponse | { status: 'error'; message: string };
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.status === 'error' ? result.message : 'Unable to load courses.');
      }
      setAvailableCourses(result.courses);
    } catch (error) {
      setCourseOptionsError(error instanceof Error ? error.message : 'Unable to load courses.');
    } finally {
      setCourseOptionsLoading(false);
    }
  };

  const openRequestForm = () => {
    setSelectedCourseCodes([]);
    setCourseSearch('');
    void loadAvailableCourses();

    setFirstName('');
    setMiddleName('');
    setLastName('');
    setRequestSchool('');
    setRequestError('');
    setRequestSuccess('');
    setCurrentView('request');
  };

  const goHome = () => {
    setCurrentView('home');
    setSelectedFaculty(null);
    setModeratorMessage('');
    setModeratorError('');
  };

  const loadModeratorRequests = async () => {
    setModeratorLoading(true);
    setModeratorError('');
    setModeratorMessage('');

    try {
      const response = await fetch('/api/mod/requests');

      const result =
        (await response.json()) as
          | ModeratorRequestsResponse
          | { status: 'error'; message: string };

      if (!response.ok || result.status !== 'success') {
        throw new Error(
          result.status === 'error'
            ? result.message
            : 'Unable to load pending requests.'
        );
      }

      setModeratorRequests(result.requests);
    } catch (err) {
      setModeratorError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading requests.'
      );
    } finally {
      setModeratorLoading(false);
    }
  };


  const loadAllFacultyForModeration = async () => {
    setFacultyManagementLoading(true);
    setFacultyManagementError('');
    try {
      const response = await fetch('/api/faculty');
      const result = (await response.json()) as FacultyListResponse | ApiErrorResponse;
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.status === 'error' ? result.message : 'Unable to load faculty.');
      }
      setAllFacultyForModeration(result.faculty);
    } catch (error) {
      setFacultyManagementError(error instanceof Error ? error.message : 'Unable to load faculty.');
    } finally {
      setFacultyManagementLoading(false);
    }
  };

  const openFacultyEditor = (record: FacultyRecord) => {
    setEditingFacultyId(record.id);
    setEditFirstName(record.firstName);
    setEditMiddleName(record.middleName ?? '');
    setEditLastName(record.lastName);
    setEditSchool(record.school);
    setEditCourseCodes(record.courseCodes ?? []);
    setEditCourseSearch('');
    setFacultyEditMessage('');
    void loadAvailableCourses();
  };

  const saveFacultyEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingFacultyId) return;
    setFacultyEditBusy(true);
    setFacultyEditMessage('');
    setFacultyManagementError('');
    try {
      const response = await fetch(`/api/mod/faculty/${encodeURIComponent(editingFacultyId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirstName,
          middleName: editMiddleName,
          lastName: editLastName,
          school: editSchool,
          courseCodes: editCourseCodes,
        }),
      });
      const result = (await response.json()) as ModerationActionResponse;
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.status === 'error' ? result.message : 'Unable to update faculty.');
      }
      setFacultyEditMessage(result.message);
      setEditingFacultyId('');
      await loadAllFacultyForModeration();
    } catch (error) {
      setFacultyManagementError(error instanceof Error ? error.message : 'Unable to update faculty.');
    } finally {
      setFacultyEditBusy(false);
    }
  };

  const openAdminDashboard = () => {
    setAdminSection('menu');
    setFacultyAdminSearch('');
    setCurrentView('admin');
    setActiveRejectId('');
    setRejectionReason('');
    setCustomReason('');
    void loadModeratorRequests();
    void loadModeratorCourseRequests();
    void loadModeratorFacultyCourseRequests();
    void loadAllFacultyForModeration();
  };

  const submitFacultyRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestError('');
    setRequestSuccess('');

    if (!firstName.trim() || !lastName.trim() || !requestSchool) {
      setRequestError('Please complete all required fields.');
      return;
    }

    setRequestLoading(true);

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          middleName,
          lastName,
          school: requestSchool,
          courseCodes: selectedCourseCodes,
        }),
      });

      const result =
        (await response.json()) as FacultyRequestSubmissionResponse;

      if (!response.ok || result.status !== 'success') {
        throw new Error(
          result.status === 'error'
            ? result.message
            : 'Unable to submit your request.'
        );
      }

      setRequestSuccess(result.message);
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setRequestSchool('');
      setSelectedCourseCodes([]);
      setCourseSearch('');
    } catch (err) {
      setRequestError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setRequestLoading(false);
    }
  };

  const openApprovalEditor = (request: FacultyRequest) => {
    setActiveApproveRequest(request);
    setApprovalFirstName(request.firstName);
    setApprovalMiddleName(request.middleName ?? '');
    setApprovalLastName(request.lastName);
    setApprovalSchool(request.school);
    setApprovalCourseCodes(request.courseCodes ?? []);
    setApprovalCourseSearch('');
    void loadAvailableCourses();
    setActiveRejectId('');
    setModeratorError('');
    setModeratorMessage('');
  };

  const cancelApprovalEditor = () => {
    setActiveApproveRequest(null);
    setApprovalFirstName('');
    setApprovalMiddleName('');
    setApprovalLastName('');
    setApprovalSchool('');
    setApprovalCourseCodes([]);
    setApprovalCourseSearch('');
  };

  const approveRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeApproveRequest) {
      return;
    }

    const request = activeApproveRequest;
    setModeratorError('');
    setModeratorMessage('');

    if (!approvalFirstName.trim() || !approvalLastName.trim()) {
      setModeratorError('First name and last name are required.');
      return;
    }

    if (!approvalSchool) {
      setModeratorError('Please select a school.');
      return;
    }

    setModerationBusyId(request.id);

    try {
      const response = await fetch(
        `/api/mod/requests/${encodeURIComponent(request.id)}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstName: approvalFirstName,
            middleName: approvalMiddleName,
            lastName: approvalLastName,
            school: approvalSchool,
            courseCodes: approvalCourseCodes,
          }),
        }
      );

      const result = (await response.json()) as ModerationActionResponse;

      if (!response.ok || result.status !== 'success') {
        throw new Error(
          result.status === 'error'
            ? result.message
            : 'Unable to approve this request.'
        );
      }

      cancelApprovalEditor();
      setModeratorMessage(result.message);
      await loadModeratorRequests();
    } catch (err) {
      setModeratorError(
        err instanceof Error ? err.message : 'Unable to approve this request.'
      );
    } finally {
      setModerationBusyId('');
    }
  };

  const rejectRequest = async (request: FacultyRequest) => {
    setModeratorError('');
    setModeratorMessage('');

    if (!rejectionReason) {
      setModeratorError('Please select a rejection reason.');
      return;
    }

    if (rejectionReason === 'Custom' && !customReason.trim()) {
      setModeratorError('Please enter a custom rejection reason.');
      return;
    }

    setModerationBusyId(request.id);

    try {
      const response = await fetch(
        `/api/mod/requests/${encodeURIComponent(request.id)}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason: rejectionReason,
            customReason,
          }),
        }
      );

      const result = (await response.json()) as ModerationActionResponse;

      if (!response.ok || result.status !== 'success') {
        throw new Error(
          result.status === 'error'
            ? result.message
            : 'Unable to reject this request.'
        );
      }

      setModeratorMessage(result.message);
      setActiveRejectId('');
      setRejectionReason('');
      setCustomReason('');
      await loadModeratorRequests();
    } catch (err) {
      setModeratorError(
        err instanceof Error ? err.message : 'Unable to reject this request.'
      );
    } finally {
      setModerationBusyId('');
    }
  };

  return (
    <div style={styles.page}>
      <main style={styles.container}>
        {currentView === 'home' && (
          <section style={{ textAlign: 'center', paddingTop: '12vh' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
              🎓
            </div>

            <h1 style={styles.title}>Faculty Rating Portal</h1>

            <p style={styles.subtitle}>
              Find faculty members and explore student ratings.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '14px',
                marginTop: '36px',
              }}
            >
              <button
                style={styles.secondaryButton}
                onClick={() => openFacultyList('check')}
              >
                Check Faculty Rating
              </button>

              <button
                style={styles.secondaryButton}
                onClick={openCourseRequestForm}
              >
                Request New Course
              </button>
            </div>

            {!moderatorCheckLoading && isModerator && (
              <div style={{ marginTop: '42px' }}>
                <button
                  style={{
                    ...styles.button,
                    backgroundColor: '#d04422',
                  }}
                  onClick={openAdminDashboard}
                >
                  ⚙ Moderator Dashboard
                </button>
              </div>
            )}
          </section>
        )}

        {currentView === 'faculty' && (
          <section>
            <button
              onClick={goHome}
              style={{
                ...styles.secondaryButton,
                padding: '8px 14px',
                marginBottom: '24px',
              }}
            >
              ← Home
            </button>

            <h1 style={styles.title}>
              Faculty Ratings
            </h1>

            <p style={styles.subtitle}>
              Search for a faculty member or filter by school.
            </p>
            <button
              type="button"
              style={{ ...styles.button, marginBottom: '18px' }}
              onClick={openRequestForm}
            >
              + Request a Faculty
            </button>

            <div style={{ display: 'grid', gap: '14px' }}>
              <input
                type="search"
                placeholder="Search faculty by name..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={styles.input}
              />

              <select
                value={selectedSchool}
                onChange={(event) => setSelectedSchool(event.target.value)}
                style={styles.input}
              >
                <option value="">All Schools</option>
                {SCHOOLS.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
              <select
                value={selectedCourse}
                onChange={(event) => setSelectedCourse(event.target.value)}
                style={styles.input}
              >
                <option value="">All Courses</option>
                {availableCourses.map((course) => (
                  <option key={course.code} value={course.code}>{course.code}</option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '26px' }}>
              {loading && (
                <p style={{ color: '#aaa', textAlign: 'center' }}>
                  Loading faculty...
                </p>
              )}

              {!loading && error && (
                <div
                  style={{
                    backgroundColor: '#492323',
                    border: '1px solid #8e3939',
                    borderRadius: '8px',
                    padding: '14px',
                    color: '#ffb3b3',
                  }}
                >
                  {error}
                </div>
              )}

              {!loading && !error && faculty.length === 0 && (
                <div
                  style={{
                    backgroundColor: '#252526',
                    border: '1px solid #383838',
                    borderRadius: '10px',
                    padding: '28px 18px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>
                    🔎
                  </div>

                  <h3 style={{ margin: '0 0 10px' }}>
                    {search || selectedSchool
                      ? 'No matching faculty found'
                      : 'No faculty added yet'}
                  </h3>

                  <p style={styles.muted}>
                    {search || selectedSchool
                      ? 'Try changing your search or school filter.'
                      : 'Faculty records will appear here once they are added.'}
                  </p>
                </div>
              )}

              {!loading && !error && faculty.length > 0 && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  <p style={styles.muted}>
                    {faculty.length} faculty member
                    {faculty.length === 1 ? '' : 's'} found
                  </p>

                  {faculty.map((record) => (
                    <div
                      key={record.id}
                      style={{
                        ...styles.card,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFaculty(record);
                          setRatingMode('check');
                          setCurrentView('faculty-detail');
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          color: 'inherit',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <strong style={{ fontSize: '1.05rem' }}>
                          {getFullName(record)}
                        </strong>
                        <p style={{ ...styles.muted, marginBottom: 0, marginTop: '7px' }}>
                          School: {record.school}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                          {(record.courseCodes ?? []).length > 0 ? record.courseCodes!.map((code) => (
                            <span key={code} style={{ background: '#173d5a', border: '1px solid #287bb3', color: '#d6edff', borderRadius: '12px', padding: '3px 8px', fontSize: '0.78rem' }}>{code}</span>
                          )) : <span style={{ ...styles.muted, fontSize: '0.8rem' }}>No courses assigned</span>}
                        </div>
                        <p style={{ ...styles.muted, marginBottom: 0, marginTop: '5px' }}>
                          {record.ratingCount ?? 0} {record.ratingCount === 1 ? 'rating' : 'ratings'}
                        </p>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          disabled={Boolean(record.hasRated)}
                          onClick={() => {
                            if (record.hasRated) return;
                            setSelectedFaculty(record);
                            setRatingMode('rate');
                            setCurrentView('faculty-detail');
                          }}
                          style={{
                            padding: '7px 13px',
                            borderRadius: '7px',
                            border: '1px solid',
                            borderColor: record.hasRated ? '#555' : '#0079D3',
                            backgroundColor: record.hasRated ? '#3a3a3a' : '#0079D3',
                            color: record.hasRated ? '#999' : '#fff',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: record.hasRated ? 'not-allowed' : 'pointer',
                            opacity: record.hasRated ? 0.7 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {record.hasRated ? 'Rated' : 'Rate'}
                        </button>
                        <span style={{ color: '#38aaff', fontSize: '1.3rem' }}>→</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: '32px',
                padding: '20px',
                borderRadius: '10px',
                backgroundColor: '#252526',
                border: '1px solid #383838',
                textAlign: 'center',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Can't find your faculty?</h3>

              <p style={styles.muted}>
                Request to have a faculty member added to the directory.
              </p>

              <button style={styles.button} onClick={openRequestForm}>
                Request to Add Faculty
              </button>
            </div>
          </section>
        )}


        {currentView === 'faculty-detail' && selectedFaculty && (
          <section>
            <button
              onClick={() => setCurrentView('faculty')}
              style={{
                ...styles.secondaryButton,
                padding: '8px 14px',
                marginBottom: '24px',
              }}
            >
              ← Back to Faculty List
            </button>

            <h1 style={styles.title}>{getFullName(selectedFaculty)}</h1>
            <p style={styles.subtitle}>School: {selectedFaculty.school}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px', margin: '0 0 18px' }}>
              <strong style={{ fontSize: '0.9rem' }}>Courses:</strong>
              {(selectedFaculty.courseCodes ?? []).length > 0 ? selectedFaculty.courseCodes!.map((code) => (
                <span key={code} style={{ background: '#173d5a', border: '1px solid #287bb3', color: '#d6edff', borderRadius: '14px', padding: '5px 10px', fontSize: '0.85rem' }}>{code}</span>
              )) : <span style={styles.muted}>No courses assigned</span>}
            </div>
            <div style={{ margin: '0 0 20px', display: 'grid', gap: '10px' }}>
              <button type="button" style={{ ...styles.secondaryButton, justifySelf: 'start', padding: '7px 13px' }} onClick={() => { setShowFacultyCourseRequestEditor((current) => !current); setFacultyCourseRequestCodes([]); setFacultyCourseRequestSearch(''); setFacultyCourseRequestError(''); setFacultyCourseRequestMessage(''); void loadAvailableCourses(); }}>
                {(selectedFaculty.courseCodes ?? []).length > 0 ? '+' : 'Request Course(s) +'}
              </button>
              {facultyCourseRequestMessage && <p role="status" style={{ color: '#8de0ad', margin: 0 }}>{facultyCourseRequestMessage}</p>}
              {showFacultyCourseRequestEditor && (
                <div style={{ display: 'grid', gap: '9px' }}>
                  {facultyCourseRequestError && <p role="alert" style={{ color: '#ffb3b3', margin: 0 }}>{facultyCourseRequestError}</p>}
                  <input style={styles.input} value={facultyCourseRequestSearch} onChange={(event) => setFacultyCourseRequestSearch(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))} placeholder="Search approved course codes..." maxLength={7} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {facultyCourseRequestCodes.map((code) => <button key={code} type="button" style={styles.secondaryButton} onClick={() => setFacultyCourseRequestCodes((current) => current.filter((item) => item !== code))}>{code} ×</button>)}
                  </div>
                  {availableCourses.filter((course) => !(selectedFaculty.courseCodes ?? []).includes(course.code) && !facultyCourseRequestCodes.includes(course.code)).filter((course) => !facultyCourseRequestSearch || course.code.includes(facultyCourseRequestSearch)).slice(0, 8).map((course) => (
                    <button key={course.code} type="button" style={{ ...styles.secondaryButton, textAlign: 'left', padding: '8px 12px' }} onClick={() => setFacultyCourseRequestCodes((current) => [...current, course.code])}>+ {course.code}</button>
                  ))}
                  <button type="button" style={styles.button} onClick={() => void submitFacultyCourseTagRequest()} disabled={facultyCourseRequestBusy || facultyCourseRequestCodes.length === 0}>{facultyCourseRequestBusy ? 'Submitting...' : 'Submit Course Request'}</button>
                </div>
              )}
            </div>


            {ratingLoading && <p style={styles.muted}>Loading ratings...</p>}
            {ratingError && (
              <div role="alert" style={{ color: '#ffb3b3', marginBottom: '14px' }}>
                {ratingError}
              </div>
            )}
            {ratingMessage && (
              <div role="status" style={{ color: '#8de0ad', marginBottom: '14px' }}>
                {ratingMessage}
              </div>
            )}

            {ratingMode === 'check' && (
            <div style={{ ...styles.card, display: 'grid', gap: '18px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Faculty Rating Summary</h3>
                <strong>{ratingSummary?.count ?? 0} {ratingSummary?.count === 1 ? 'rating' : 'ratings'}</strong>
              </div>

              {ratingLabels.map(({ key, label }) => {
                const value = ratingSummary?.averages[key] ?? 0;
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                      <strong>{label}</strong>
                      <strong>{key === 'classAverage' ? `${value} Marks` : `${value}%`}</strong>
                    </div>
                    <div
                      style={{
                        height: '14px',
                        position: 'relative',
                        background: 'linear-gradient(to right, #111 0%, #e53935 25%, #ff9800 50%, #ffeb3b 75%, #4caf50 100%)',
                        borderRadius: '20px',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: `${value}%`,
                          top: '-3px',
                          height: '20px',
                          width: '4px',
                          background: '#fff',
                          border: '1px solid #222',
                          borderRadius: '3px',
                          transform: 'translateX(-50%)',
                        }}
                      />
                    </div>
                    <div className="rating-legend">
                      {(key === 'teaching'
                        ? [
                            ['#111111', 'BLACK', 'It is hard to grasp what they teach'],
                            ['#ff9800', 'ORANGE', 'Not good, but not bad either'],
                            ['#4caf50', 'GREEN', 'Their teaching is pretty easy to grasp'],
                          ]
                        : key === 'internalMarking' || key === 'examEvaluation'
                          ? [
                              ['#111111', 'BLACK', 'Unnecessarily Strict evaluation'],
                              ['#e53935', 'RED', 'Strict evaluation'],
                              ['#ff9800', 'ORANGE', 'Fair evaluation'],
                              ['#ffeb3b', 'YELLOW', 'Lenient evaluation'],
                              ['#4caf50', 'GREEN', 'Free Marks'],
                            ]
                          : key === 'overallRecommendation'
                            ? [
                                ['#111111', 'BLACK', "It's better to drop the course"],
                                ['#e53935', 'RED', 'Only as a last option'],
                                ['#ff9800', 'ORANGE', 'Okay, not bad but not great either'],
                                ['#ffeb3b', 'YELLOW', 'Definitely good as second option'],
                                ['#4caf50', 'GREEN', 'Goated, would recommend for sure'],
                              ]
                            : [
                                ['#111111', '0–20 Marks', ''],
                                ['#e53935', '20–40 Marks', ''],
                                ['#ff9800', '40–60 Marks', ''],
                                ['#ffeb3b', '60–80 Marks', ''],
                                ['#4caf50', '80–100 Marks', ''],
                              ]
                      ).map(([color, name, description]) => (
                        <div className="rating-legend-item" key={name}>
                          <span className="rating-legend-swatch" style={{ backgroundColor: color }} />
                          <span><strong>{name}</strong>{description ? ` — ${description}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

            </div>
            )}

            {ratingMode === 'rate' && (
              <div style={{ ...styles.card, display: 'grid', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Submit Your Rating</h3>
                {!ratingSummary?.eligibility.loggedIn && (
                  <p style={styles.muted}>Log in to Reddit to check your eligibility and submit a rating.</p>
                )}
                {ratingSummary?.eligibility.loggedIn && !ratingSummary.eligibility.eligible && (
                  <div style={{ background: '#492323', border: '1px solid #8e3939', borderRadius: '8px', padding: '12px', color: '#ffb3b3' }}>
                    {ratingSummary.eligibility.reason}
                    <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
                      Current account age: {ratingSummary.eligibility.accountAgeDays} days · Total karma: {ratingSummary.eligibility.totalKarma}
                    </p>
                  </div>
                )}
                {ratingSummary?.eligibility.hasRated && (
                  <p style={{ color: '#8de0ad', margin: 0 }}>You have already submitted a rating for this faculty member.</p>
                )}
                {ratingSummary?.eligibility.eligible && !ratingSummary.eligibility.hasRated && (
                  <form onSubmit={submitFacultyRating} style={{ display: 'grid', gap: '18px' }}>
                    {ratingLabels.map(({ key }) => {
                      const isClassAverage = key === 'classAverage';
                      const question =
                        key === 'teaching'
                          ? 'How would you rate their Teaching?'
                          : key === 'internalMarking'
                            ? 'How would you rate their Internal Marking evaluation based on what you feel?'
                            : key === 'examEvaluation'
                              ? 'How would you rate their exam evaluation?'
                              : key === 'classAverage'
                                ? "Select the Avg you think this faculty's class usually has out of 100"
                                : 'Overall, would you recommend them?';
                      const legends =
                        key === 'teaching'
                          ? [
                              ['#111111', 'BLACK', 'It is hard to grasp what they teach'],
                              ['#ff9800', 'ORANGE', 'Not good, but not bad either'],
                              ['#4caf50', 'GREEN', 'Their teaching is pretty easy to grasp'],
                            ]
                          : key === 'internalMarking' || key === 'examEvaluation'
                            ? [
                                ['#111111', 'BLACK', 'Unnecessarily Strict evaluation'],
                                ['#e53935', 'RED', 'Strict evaluation'],
                                ['#ff9800', 'ORANGE', 'Fair evaluation'],
                                ['#ffeb3b', 'YELLOW', 'Lenient evaluation'],
                                ['#4caf50', 'GREEN', 'Free Marks'],
                              ]
                            : key === 'overallRecommendation'
                              ? [
                                  ['#111111', 'BLACK', "It's better to drop the course"],
                                  ['#e53935', 'RED', 'Only as a last option'],
                                  ['#ff9800', 'ORANGE', 'Okay, not bad but not great either'],
                                  ['#ffeb3b', 'YELLOW', 'Definitely good as second option'],
                                  ['#4caf50', 'GREEN', 'Goated, would recommend for sure'],
                                ]
                              : [];
                      return (
                        <div key={key}>
                          <label style={styles.label}>{question}</label>
                          <div className="rating-value">
                            {ratingValues[key]} {isClassAverage ? 'Marks' : '%'}
                          </div>
                          <input
                            className="rating-slider"
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={ratingValues[key]}
                            onChange={(event) => setRatingValues((current) => ({ ...current, [key]: Number(event.target.value) }))}
                            aria-label={question}
                          />
                          {legends.length > 0 && (
                            <div className="rating-legend">
                              {legends.map(([color, name, description]) => (
                                <div className="rating-legend-item" key={name}>
                                  <span className="rating-legend-swatch" style={{ backgroundColor: color }} />
                                  <span><strong>{name}</strong> — {description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button type="submit" style={styles.button} disabled={ratingSubmitting}>
                      {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
                    </button>
                    <p style={{ ...styles.muted, margin: 0 }}>
                      Eligibility: Reddit account at least 30 days old and at least 15 total karma. One rating per account per faculty member.
                    </p>
                  </form>
                )}
              </div>
            )}
          </section>
        )}

        {currentView === 'request' && (
          <section>
            <button
              onClick={() => setCurrentView('faculty')}
              style={{
                ...styles.secondaryButton,
                padding: '8px 14px',
                marginBottom: '24px',
              }}
            >
              ← Back to Faculty List
            </button>

            <h1 style={styles.title}>Request to Add Faculty</h1>

            <p style={styles.subtitle}>
              Submit the faculty member's details. A moderator will review
              your request before the faculty member is added.
            </p>

            {requestSuccess ? (
              <div
                style={{
                  backgroundColor: '#173d2b',
                  border: '1px solid #28764d',
                  borderRadius: '10px',
                  padding: '22px',
                }}
              >
                <h3 style={{ color: '#8de0ad', marginTop: 0 }}>
                  Request submitted successfully
                </h3>

                <p style={{ color: '#d2f4df' }}>{requestSuccess}</p>

                <p style={styles.muted}>
                  Your request is pending moderator review.
                </p>

                <button
                  style={styles.button}
                  onClick={() => setCurrentView('faculty')}
                >
                  Back to Faculty List
                </button>
              </div>
            ) : (
              <form
                onSubmit={submitFacultyRequest}
                style={{
                  backgroundColor: '#252526',
                  border: '1px solid #383838',
                  borderRadius: '10px',
                  padding: '22px',
                  display: 'grid',
                  gap: '18px',
                }}
              >
                <div>
                  <label style={styles.label} htmlFor="firstName">
                    First Name *
                  </label>

                  <input
                    id="firstName"
                    style={styles.input}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Enter first name"
                    maxLength={60}
                    required
                  />
                </div>

                <div>
                  <label style={styles.label} htmlFor="middleName">
                    Middle Name
                  </label>

                  <input
                    id="middleName"
                    style={styles.input}
                    value={middleName}
                    onChange={(event) => setMiddleName(event.target.value)}
                    placeholder="Enter middle name (optional)"
                    maxLength={60}
                  />
                </div>

                <div>
                  <label style={styles.label} htmlFor="lastName">
                    Last Name *
                  </label>

                  <input
                    id="lastName"
                    style={styles.input}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Enter last name"
                    maxLength={60}
                    required
                  />
                </div>

                <div>
                  <label style={styles.label} htmlFor="requestSchool">
                    School *
                  </label>

                  <select
                    id="requestSchool"
                    style={styles.input}
                    value={requestSchool}
                    onChange={(event) => setRequestSchool(event.target.value)}
                    required
                  >
                    <option value="">Select a school</option>

                    {SCHOOLS.map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                  </select>
                </div>


                <div>
                  <label style={styles.label} htmlFor="faculty-course-search">Course(s) (Optional)</label>
                  <input
                    id="faculty-course-search"
                    style={styles.input}
                    value={courseSearch}
                    onChange={(event) => setCourseSearch(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
                    placeholder="Search course code, e.g. MAT1001"
                    maxLength={7}
                  />
                  {courseOptionsLoading && <p style={styles.muted}>Loading approved courses...</p>}
                  {courseOptionsError && <p role="alert" style={{ color: '#ffb3b3' }}>{courseOptionsError}</p>}
                  {selectedCourseCodes.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '10px 0' }}>
                      {selectedCourseCodes.map((code) => (
                        <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#173d5a', border: '1px solid #287bb3', borderRadius: '18px', padding: '6px 10px' }}>
                          {code}
                          <button type="button" aria-label={`Remove ${code}`} onClick={() => setSelectedCourseCodes((current) => current.filter((item) => item !== code))} style={{ border: 0, background: 'transparent', color: '#fff', cursor: 'pointer', padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: '7px', marginTop: '8px' }}>
                    {availableCourses
                      .filter((course) => !selectedCourseCodes.includes(course.code))
                      .filter((course) => !courseSearch || course.code.includes(courseSearch))
                      .slice(0, 12)
                      .map((course) => (
                        <button
                          key={course.code}
                          type="button"
                          onClick={() => setSelectedCourseCodes((current) => [...current, course.code])}
                          style={{ ...styles.secondaryButton, textAlign: 'left', padding: '8px 12px' }}
                        >
                          + {course.code}
                        </button>
                      ))}
                    {!courseOptionsLoading && courseSearch.length > 0 && !availableCourses.some((course) => course.code.includes(courseSearch)) && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px', background: '#1d1d1e', borderRadius: '8px' }}>
                        <span style={styles.muted}>No approved course found.</span>
                        <button
                          type="button"
                          style={{ ...styles.secondaryButton, padding: '7px 10px', whiteSpace: 'nowrap' }}
                          onClick={() => {
                            setCourseCode(courseSearch);
                            setCourseRequestError('');
                            setCourseRequestSuccess('');
                            setCurrentView('course-request');
                          }}
                        >
                          Request {courseSearch}
                        </button>
                      </div>
                    )}
                  </div>
                  <p style={{ ...styles.muted, margin: '8px 0 0' }}>You can select multiple approved courses. This field is optional.</p>
                </div>

                {requestError && (
                  <div
                    role="alert"
                    style={{
                      backgroundColor: '#492323',
                      border: '1px solid #8e3939',
                      borderRadius: '8px',
                      padding: '12px',
                      color: '#ffb3b3',
                    }}
                  >
                    {requestError}
                  </div>
                )}

                <button
                  type="submit"
                  style={{
                    ...styles.button,
                    opacity: requestLoading ? 0.65 : 1,
                  }}
                  disabled={requestLoading}
                >
                  {requestLoading ? 'Submitting...' : 'Submit Request'}
                </button>

                <p style={{ ...styles.muted, margin: 0 }}>
                  * Required fields. Submitting a request does not
                  automatically add the faculty member.
                </p>
              </form>
            )}
          </section>
        )}

        
        {currentView === 'course-request' && (
          <section>
            <button
              onClick={goHome}
              style={{ ...styles.secondaryButton, padding: '8px 14px', marginBottom: '24px' }}
            >
              ← Back to Home
            </button>
            <h1 style={styles.title}>Request New Course</h1>
            <p style={styles.subtitle}>
              Submit a course code for moderator approval. Course codes must contain three letters followed by four digits.
            </p>
            {courseRequestSuccess && (
              <div role="status" style={{ backgroundColor: '#173d2b', border: '1px solid #28764d', borderRadius: '8px', padding: '12px', color: '#a5edc1', marginBottom: '16px' }}>
                {courseRequestSuccess}
              </div>
            )}
            {courseRequestError && (
              <div role="alert" style={{ backgroundColor: '#492323', border: '1px solid #8e3939', borderRadius: '8px', padding: '12px', color: '#ffb3b3', marginBottom: '16px' }}>
                {courseRequestError}
              </div>
            )}
            <form onSubmit={submitCourseRequest} style={{ ...styles.card, display: 'grid', gap: '14px' }}>
              <label style={styles.label} htmlFor="course-code">Course Code</label>
              <input
                id="course-code"
                style={styles.input}
                value={courseCode}
                onChange={(event) => setCourseCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
                placeholder="e.g. MAT1001"
                maxLength={7}
                pattern="[A-Za-z]{3}[0-9]{4}"
                required
              />
              <p style={{ ...styles.muted, margin: 0 }}>Format: XXX0000 (three letters + four digits).</p>
              <button type="submit" style={styles.button} disabled={courseRequestLoading}>
                {courseRequestLoading ? 'Submitting...' : 'Request New Course Addition'}
              </button>
            </form>
          </section>
        )}

{currentView === 'admin' && (
          <section>
            <button
              onClick={goHome}
              style={{
                ...styles.secondaryButton,
                padding: '8px 14px',
                marginBottom: '24px',
              }}
            >
              ← Back to Home
            </button>

            <h1 style={styles.title}>Moderator Dashboard</h1>

            <p style={styles.subtitle}>
              Review student-submitted faculty requests. Approving a request
              adds the faculty member to the public directory.
            </p>

            {adminSection === 'menu' && (
              <div style={{ display: 'grid', gap: '14px', marginTop: '22px' }}>
                <button type="button" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '20px' }} onClick={() => setAdminSection('faculty-requests')}>
                  <strong style={{ fontSize: '1.1rem' }}>Pending Faculty Requests</strong>
                  <span style={{ ...styles.muted, marginTop: '7px' }}>{moderatorRequests.length ? `${moderatorRequests.length} pending request(s)` : 'No pending requests'}</span>
                  <span style={{ color: '#38aaff', marginTop: '10px' }}>Open requests →</span>
                </button>
                <button type="button" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '20px' }} onClick={() => setAdminSection('course-requests')}>
                  <strong style={{ fontSize: '1.1rem' }}>Pending Course Requests</strong>
                  <span style={{ ...styles.muted, marginTop: '7px' }}>{moderatorCourseRequests.length + moderatorFacultyCourseRequests.length ? `${moderatorCourseRequests.length + moderatorFacultyCourseRequests.length} pending request(s)` : 'No pending requests'}</span>
                  <span style={{ color: '#38aaff', marginTop: '10px' }}>Open requests →</span>
                </button>
                <button type="button" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '20px' }} onClick={() => setAdminSection('faculties')}>
                  <strong style={{ fontSize: '1.1rem' }}>Edit Faculties</strong>
                  <span style={{ ...styles.muted, marginTop: '7px' }}>{allFacultyForModeration.length} faculty member(s) in directory</span>
                  <span style={{ color: '#38aaff', marginTop: '10px' }}>Browse faculty →</span>
                </button>
              </div>
            )}

            {adminSection !== 'menu' && (
              <button type="button" style={{ ...styles.secondaryButton, marginBottom: '18px', padding: '8px 14px' }} onClick={() => setAdminSection('menu')}>← Dashboard</button>
            )}

            {adminSection === 'faculty-requests' && (
              <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <strong>Pending Requests ({moderatorRequests.length})</strong>

              <button
                style={{
                  ...styles.secondaryButton,
                  padding: '8px 12px',
                  fontSize: '0.9rem',
                }}
                onClick={() => void loadModeratorRequests()}
                disabled={moderatorLoading}
              >
                {moderatorLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {moderatorMessage && (
              <div
                role="status"
                style={{
                  backgroundColor: '#173d2b',
                  border: '1px solid #28764d',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#a5edc1',
                  marginBottom: '16px',
                }}
              >
                {moderatorMessage}
              </div>
            )}

            {moderatorError && (
              <div
                role="alert"
                style={{
                  backgroundColor: '#492323',
                  border: '1px solid #8e3939',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#ffb3b3',
                  marginBottom: '16px',
                }}
              >
                {moderatorError}
              </div>
            )}

            {moderatorLoading && (
              <p style={{ ...styles.muted, textAlign: 'center' }}>
                Loading pending requests...
              </p>
            )}

            {!moderatorLoading && moderatorRequests.length === 0 && (
              <div
                style={{
                  ...styles.card,
                  textAlign: 'center',
                  padding: '30px 18px',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>
                  ✓
                </div>

                <h3 style={{ margin: '0 0 8px' }}>No pending requests</h3>

                <p style={styles.muted}>
                  New faculty requests will appear here.
                </p>
              </div>
            )}

            {!moderatorLoading && moderatorRequests.length > 0 && (
              <div style={{ display: 'grid', gap: '16px' }}>
                {moderatorRequests.map((request) => {
                  const isBusy = moderationBusyId === request.id;
                  const isRejecting = activeRejectId === request.id;
                  const isEditingApproval = activeApproveRequest?.id === request.id;

                  return (
                    <article
                      key={request.id}
                      style={{
                        ...styles.card,
                        display: 'grid',
                        gap: '13px',
                      }}
                    >
                      <div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>
                          {getFullName(request)}
                        </h3>

                        <p style={{ ...styles.muted, margin: '4px 0' }}>
                          School: <strong>{request.school}</strong>
                        </p>
                        <div style={{ marginTop: '9px' }}>
                          <p style={{ ...styles.muted, margin: '4px 0' }}>Requested courses:</p>
                          {(request.courseCodes ?? []).length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {request.courseCodes!.map((code) => (
                                <span key={code} style={{ background: '#173d5a', border: '1px solid #287bb3', color: '#d6edff', borderRadius: '14px', padding: '4px 9px', fontSize: '0.85rem' }}>{code}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ ...styles.muted, fontSize: '0.9rem' }}>No courses selected</span>
                          )}
                        </div>

                        <p style={{ ...styles.muted, margin: '4px 0' }}>
                          Submitted by: u/{request.submittedByUsername}
                        </p>

                        <p style={{ ...styles.muted, margin: '4px 0' }}>
                          Submitted: {formatDate(request.createdAt)}
                        </p>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <button
                          style={{
                            ...styles.button,
                            backgroundColor: '#23834c',
                            opacity: isBusy ? 0.6 : 1,
                          }}
                          onClick={() => openApprovalEditor(request)}
                          disabled={Boolean(moderationBusyId) || Boolean(activeApproveRequest)}
                        >
                          ✓ Approve
                        </button>

                        <button
                          style={{
                            ...styles.secondaryButton,
                            borderColor: '#d04444',
                            color: '#ff7777',
                            opacity: isBusy ? 0.6 : 1,
                          }}
                          onClick={() => {
                            setActiveRejectId(
                              isRejecting ? '' : request.id
                            );
                            setRejectionReason('');
                            setCustomReason('');
                            setModeratorError('');
                          }}
                          disabled={Boolean(moderationBusyId)}
                        >
                          Reject
                        </button>
                      </div>

                      {isEditingApproval && (
                        <form
                          onSubmit={approveRequest}
                          style={{
                            borderTop: '1px solid #444',
                            paddingTop: '15px',
                            display: 'grid',
                            gap: '13px',
                          }}
                        >
                          <div>
                            <h4 style={{ margin: '0 0 6px' }}>Edit Faculty Details</h4>
                            <p style={{ ...styles.muted, margin: 0 }}>
                              Review and correct the submitted details before adding this faculty member.
                            </p>
                          </div>

                          <div>
                            <label style={styles.label} htmlFor={`approval-first-${request.id}`}>
                              First Name *
                            </label>
                            <input
                              id={`approval-first-${request.id}`}
                              style={styles.input}
                              value={approvalFirstName}
                              onChange={(event) => setApprovalFirstName(event.target.value)}
                              maxLength={60}
                              required
                            />
                          </div>

                          <div>
                            <label style={styles.label} htmlFor={`approval-middle-${request.id}`}>
                              Middle Name
                            </label>
                            <input
                              id={`approval-middle-${request.id}`}
                              style={styles.input}
                              value={approvalMiddleName}
                              onChange={(event) => setApprovalMiddleName(event.target.value)}
                              maxLength={60}
                            />
                          </div>

                          <div>
                            <label style={styles.label} htmlFor={`approval-last-${request.id}`}>
                              Last Name *
                            </label>
                            <input
                              id={`approval-last-${request.id}`}
                              style={styles.input}
                              value={approvalLastName}
                              onChange={(event) => setApprovalLastName(event.target.value)}
                              maxLength={60}
                              required
                            />
                          </div>

                          <div>
                            <label style={styles.label} htmlFor={`approval-school-${request.id}`}>
                              School *
                            </label>
                            <select
                              id={`approval-school-${request.id}`}
                              style={styles.input}
                              value={approvalSchool}
                              onChange={(event) => setApprovalSchool(event.target.value)}
                              required
                            >
                              <option value="">Select a school</option>
                              {SCHOOLS.map((school) => (
                                <option key={school} value={school}>
                                  {school}
                                </option>
                              ))}
                            </select>
                          </div>


                          <div style={{ display: 'grid', gap: '9px' }}>
                            <label style={styles.label}>Courses (Optional)</label>
                            <input
                              style={styles.input}
                              value={approvalCourseSearch}
                              onChange={(event) => setApprovalCourseSearch(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
                              placeholder="Search approved course codes..."
                              maxLength={7}
                            />
                            {approvalCourseCodes.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                                {approvalCourseCodes.map((code) => (
                                  <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#173d5a', border: '1px solid #287bb3', borderRadius: '16px', padding: '5px 9px' }}>
                                    {code}
                                    <button type="button" onClick={() => setApprovalCourseCodes((current) => current.filter((item) => item !== code))} style={{ border: 0, background: 'transparent', color: '#fff', cursor: 'pointer', padding: 0 }} aria-label={`Remove ${code}`}>×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {courseOptionsLoading && <p style={styles.muted}>Loading approved courses...</p>}
                            <div style={{ display: 'grid', gap: '7px' }}>
                              {availableCourses
                                .filter((course) => !approvalCourseCodes.includes(course.code))
                                .filter((course) => !approvalCourseSearch || course.code.includes(approvalCourseSearch))
                                .slice(0, 10)
                                .map((course) => (
                                  <button
                                    key={course.code}
                                    type="button"
                                    style={{ ...styles.secondaryButton, textAlign: 'left', padding: '8px 11px' }}
                                    onClick={() => setApprovalCourseCodes((current) => [...current, course.code])}
                                  >
                                    + {course.code}
                                  </button>
                                ))}
                              {!courseOptionsLoading && approvalCourseSearch && !availableCourses.some((course) => course.code.includes(approvalCourseSearch)) && (
                                <p style={styles.muted}>No approved course matches this search.</p>
                              )}
                            </div>
                            <p style={{ ...styles.muted, margin: 0 }}>Review, add or remove course tags before approving this faculty request.</p>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            <button
                              type="submit"
                              style={{ ...styles.button, backgroundColor: '#23834c' }}
                              disabled={Boolean(moderationBusyId)}
                            >
                              {isBusy ? 'Saving...' : 'Confirm & Approve'}
                            </button>
                            <button
                              type="button"
                              style={styles.secondaryButton}
                              onClick={cancelApprovalEditor}
                              disabled={Boolean(moderationBusyId)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {isRejecting && (
                        <div
                          style={{
                            borderTop: '1px solid #444',
                            paddingTop: '15px',
                            display: 'grid',
                            gap: '12px',
                          }}
                        >
                          <label style={styles.label} htmlFor={`reason-${request.id}`}>
                            Rejection Reason *
                          </label>

                          <select
                            id={`reason-${request.id}`}
                            style={styles.input}
                            value={rejectionReason}
                            onChange={(event) =>
                              setRejectionReason(event.target.value)
                            }
                          >
                            <option value="">Select a reason</option>

                            {REJECTION_REASONS.map((reason) => (
                              <option key={reason} value={reason}>
                                {reason}
                              </option>
                            ))}
                          </select>

                          {rejectionReason === 'Custom' && (
                            <div>
                              <label
                                style={styles.label}
                                htmlFor={`custom-${request.id}`}
                              >
                                Custom Explanation *
                              </label>

                              <textarea
                                id={`custom-${request.id}`}
                                style={{
                                  ...styles.input,
                                  minHeight: '100px',
                                  resize: 'vertical',
                                }}
                                value={customReason}
                                onChange={(event) =>
                                  setCustomReason(event.target.value)
                                }
                                placeholder="Explain why this request is being rejected..."
                                maxLength={300}
                              />
                            </div>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <button
                              style={{
                                ...styles.button,
                                backgroundColor: '#b83232',
                              }}
                              onClick={() => void rejectRequest(request)}
                              disabled={Boolean(moderationBusyId)}
                            >
                              {isBusy ? 'Processing...' : 'Confirm Rejection'}
                            </button>

                            <button
                              style={styles.secondaryButton}
                              onClick={() => {
                                setActiveRejectId('');
                                setRejectionReason('');
                                setCustomReason('');
                              }}
                              disabled={Boolean(moderationBusyId)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}


              </>
            )}

            {adminSection === 'faculties' && (
              <>
            <div style={{ borderTop: '1px solid #444', marginTop: '30px', paddingTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>Manage Faculty ({allFacultyForModeration.length})</h2>
                <button type="button" style={{ ...styles.secondaryButton, padding: '8px 12px' }} onClick={() => void loadAllFacultyForModeration()} disabled={facultyManagementLoading}>
                  {facultyManagementLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              {facultyEditMessage && <p role="status" style={{ color: '#8de0ad' }}>{facultyEditMessage}</p>}
              {facultyManagementError && <p role="alert" style={{ color: '#ffb3b3' }}>{facultyManagementError}</p>}
              {facultyManagementLoading && <p style={styles.muted}>Loading faculty directory...</p>}
              <input type="search" style={styles.input} placeholder="Search faculty by name..." value={facultyAdminSearch} onChange={(event) => setFacultyAdminSearch(event.target.value)} />
              {!facultyManagementLoading && allFacultyForModeration.filter((record) => getFullName(record).toLowerCase().includes(facultyAdminSearch.trim().toLowerCase())).map((record) => (
                <article key={record.id} style={{ ...styles.card, display: 'grid', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <strong>{getFullName(record)}</strong>
                      <p style={{ ...styles.muted, margin: '4px 0' }}>School: {record.school}</p>
                      <p style={{ ...styles.muted, margin: '4px 0' }}>Courses: {(record.courseCodes ?? []).join(', ') || 'None'}</p>
                    </div>
                    <button type="button" style={{ ...styles.secondaryButton, padding: '7px 12px' }} onClick={() => openFacultyEditor(record)}>Edit</button>
                  </div>
                  {editingFacultyId === record.id && (
                    <form onSubmit={saveFacultyEdit} style={{ display: 'grid', gap: '10px', borderTop: '1px solid #444', paddingTop: '12px' }}>
                      <label style={styles.label}>First Name *</label>
                      <input style={styles.input} value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} maxLength={60} required />
                      <label style={styles.label}>Middle Name</label>
                      <input style={styles.input} value={editMiddleName} onChange={(event) => setEditMiddleName(event.target.value)} maxLength={60} />
                      <label style={styles.label}>Last Name *</label>
                      <input style={styles.input} value={editLastName} onChange={(event) => setEditLastName(event.target.value)} maxLength={60} required />
                      <label style={styles.label}>School *</label>
                      <select style={styles.input} value={editSchool} onChange={(event) => setEditSchool(event.target.value)} required>
                        {SCHOOLS.map((school) => <option key={school} value={school}>{school}</option>)}
                      </select>
                      <label style={styles.label}>Assigned Courses</label>
                      <input style={styles.input} value={editCourseSearch} onChange={(event) => setEditCourseSearch(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))} placeholder="Search approved course codes..." maxLength={7} />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                        {editCourseCodes.map((code) => (
                          <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#173d5a', border: '1px solid #287bb3', borderRadius: '15px', padding: '5px 9px' }}>
                            {code}
                            <button type="button" onClick={() => setEditCourseCodes((current) => current.filter((item) => item !== code))} style={{ border: 0, background: 'transparent', color: '#fff', cursor: 'pointer' }}>×</button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {availableCourses.filter((course) => !editCourseCodes.includes(course.code)).filter((course) => !editCourseSearch || course.code.includes(editCourseSearch)).slice(0, 10).map((course) => (
                          <button key={course.code} type="button" style={{ ...styles.secondaryButton, textAlign: 'left', padding: '7px 10px' }} onClick={() => setEditCourseCodes((current) => [...current, course.code])}>+ {course.code}</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
                        <button type="submit" style={{ ...styles.button, backgroundColor: '#23834c' }} disabled={facultyEditBusy}>{facultyEditBusy ? 'Saving...' : 'Save Faculty Changes'}</button>
                        <button type="button" style={styles.secondaryButton} onClick={() => setEditingFacultyId('')} disabled={facultyEditBusy}>Cancel</button>
                      </div>
                    </form>
                  )}
                </article>
              ))}
            </div>
              </>
            )}

            {adminSection === 'course-requests' && (
              <>
            <div style={{ borderTop: '1px solid #444', marginTop: '30px', paddingTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                <h2 style={{ margin: 0 }}>Course Requests ({moderatorCourseRequests.length})</h2>
                <button
                  style={{ ...styles.secondaryButton, padding: '8px 12px', fontSize: '0.9rem' }}
                  onClick={() => void loadModeratorCourseRequests()}
                  disabled={courseModerationLoading}
                >
                  {courseModerationLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              {courseModerationMessage && <div role="status" style={{ color: '#a5edc1', marginBottom: '12px' }}>{courseModerationMessage}</div>}
              {courseModerationError && <div role="alert" style={{ color: '#ffb3b3', marginBottom: '12px' }}>{courseModerationError}</div>}
              {courseModerationLoading && <p style={styles.muted}>Loading course requests...</p>}
              {moderatorFacultyCourseRequests.length > 0 && (
                <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
                  <h3>Faculty Course Tag Requests ({moderatorFacultyCourseRequests.length})</h3>
                  {moderatorFacultyCourseRequests.map((request) => (
                    <article key={request.id} style={{ ...styles.card, display: 'grid', gap: '10px' }}>
                      <strong>{request.facultyName}</strong>
                      <span style={styles.muted}>Requested by u/{request.submittedByUsername}</span>
                      {request.courseCodes.map((code) => (
                        <label key={code} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="checkbox" checked={(moderatorFacultyCourseSelection[request.id] ?? request.courseCodes).includes(code)} onChange={(event) => setModeratorFacultyCourseSelection((current) => ({ ...current, [request.id]: event.target.checked ? [...(current[request.id] ?? request.courseCodes), code] : (current[request.id] ?? request.courseCodes).filter((item) => item !== code) }))} />
                          {code}
                        </label>
                      ))}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" style={{ ...styles.button, backgroundColor: '#23834c' }} onClick={() => void moderateFacultyCourseTagRequest(request, true)}>Approve Selected</button>
                        <button type="button" style={{ ...styles.secondaryButton, borderColor: '#d04444', color: '#ff7777' }} onClick={() => void moderateFacultyCourseTagRequest(request, false)}>Reject Request</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {!courseModerationLoading && moderatorCourseRequests.length === 0 && (
                <p style={styles.muted}>No pending course requests.</p>
              )}
              {!courseModerationLoading && moderatorCourseRequests.map((request) => (
                <article key={request.id} style={{ ...styles.card, display: 'grid', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px' }}>{request.code}</h3>
                    <p style={{ ...styles.muted, margin: '4px 0' }}>Submitted by: u/{request.submittedByUsername}</p>
                    <p style={{ ...styles.muted, margin: '4px 0' }}>Submitted: {formatDate(request.createdAt)}</p>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <button
                      style={{ ...styles.button, backgroundColor: '#23834c' }}
                      onClick={() => void moderateCourseRequest(request, 'approve')}
                      disabled={Boolean(courseModerationBusyId)}
                    >
                      {courseModerationBusyId === request.id ? 'Processing...' : '✓ Approve'}
                    </button>
                    <button
                      style={{ ...styles.secondaryButton, borderColor: '#d04444', color: '#ff7777' }}
                      onClick={() => {
                        setCourseRejectId(courseRejectId === request.id ? '' : request.id);
                        setCourseRejectReason('');
                        setCourseCustomReason('');
                      }}
                      disabled={Boolean(courseModerationBusyId)}
                    >
                      Reject
                    </button>
                  </div>
                  {courseRejectId === request.id && (
                    <div style={{ borderTop: '1px solid #444', paddingTop: '12px', display: 'grid', gap: '10px' }}>
                      <label style={styles.label}>Rejection Reason</label>
                      <select style={styles.input} value={courseRejectReason} onChange={(event) => setCourseRejectReason(event.target.value)}>
                        <option value="">Select a reason</option>
                        {REJECTION_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                      {courseRejectReason === 'Custom' && (
                        <textarea
                          style={{ ...styles.input, minHeight: '90px' }}
                          value={courseCustomReason}
                          onChange={(event) => setCourseCustomReason(event.target.value)}
                          placeholder="Enter rejection reason..."
                          maxLength={300}
                        />
                      )}
                      <button
                        style={{ ...styles.button, backgroundColor: '#b83232' }}
                        onClick={() => void moderateCourseRequest(request, 'reject')}
                        disabled={!courseRejectReason || (courseRejectReason === 'Custom' && !courseCustomReason.trim()) || Boolean(courseModerationBusyId)}
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

const rootElement =
  document.getElementById('root') || document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(<App />);
}