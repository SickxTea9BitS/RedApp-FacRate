import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  ApiErrorResponse,
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

type View = 'home' | 'faculty' | 'faculty-detail' | 'request' | 'course-request' | 'admin' | 'admin-console';
type RatingMode = 'check' | 'rate';

const styles = {
  page: {
    backgroundColor: '#2b3258',
    color: '#ffffff',
    minHeight: '100vh',
    padding: 'clamp(20px, 4vw, 44px) 20px',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxSizing: 'border-box' as const,
  },
  container: {
    width: '100%',
    maxWidth: '860px',
    margin: '0 auto',
  },
  title: {
    fontSize: 'clamp(2rem, 5vw, 2.65rem)',
    fontWeight: 800,
    letterSpacing: '-0.045em',
    lineHeight: 1.12,
    marginBottom: '12px',
  },
  subtitle: {
    color: '#c6cde2',
    marginBottom: '30px',
    lineHeight: 1.65,
    fontSize: '1.03rem',
  },
  button: {
    padding: '13px 22px',
    borderRadius: '12px',
    border: '1px solid #8bb8ff',
    backgroundColor: '#6ea8ff',
    color: '#172344',
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '12px 21px',
    borderRadius: '12px',
    border: '1px solid #7185bd',
    backgroundColor: '#343d68',
    color: '#e8efff',
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '15px 16px',
    borderRadius: '13px',
    border: '1px solid #596795',
    backgroundColor: '#252d50',
    color: 'white',
    fontSize: '1rem',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  card: {
    backgroundColor: '#343d68',
    border: '1px solid #4a5687',
    borderRadius: '18px',
    padding: '20px',
    textAlign: 'left' as const,
    color: 'white',
    width: '100%',
  },
  muted: {
    color: '#b5bfdc',
    fontSize: '0.9rem',
  },
  label: {
    display: 'block',
    marginBottom: '7px',
    color: '#e4e9f7',
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
  const [adminRole, setAdminRole] = useState<'owner' | 'admin' | 'none'>('none');
  const [adminSectionView, setAdminSectionView] = useState<'overview' | 'admins' | 'moderator-logs' | 'admin-logs' | 'security-logs' | 'data-export' | 'data-import'>('overview');
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; username: string; addedAt: number }>>([]);
  const [pendingAdminRemoval, setPendingAdminRemoval] = useState<{ id: string; username: string } | null>(null);
  const [adminLogs, setAdminLogs] = useState<Array<{ id: string; actorUsername: string; action: string; timestamp: number; details: Record<string, unknown>; result: string }>>([]);
  const [adminLogPage, setAdminLogPage] = useState(1);
  const [adminLogTotal, setAdminLogTotal] = useState(0);
  const [adminTargetId, setAdminTargetId] = useState('');
  const [adminTargetUsername, setAdminTargetUsername] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminConfirmText, setAdminConfirmText] = useState('');
  const [dataExportType, setDataExportType] = useState<'faculty' | 'courses' | 'ratings' | 'all'>('faculty');
  const [includeFacultyAssignments, setIncludeFacultyAssignments] = useState(true);
  const [facultyCourseDataOnly, setFacultyCourseDataOnly] = useState(false);
  const [dataTransferBusy, setDataTransferBusy] = useState(false);
  const [dataTransferMessage, setDataTransferMessage] = useState('');
  const [dataTransferError, setDataTransferError] = useState('');
  const [dataImportMode, setDataImportMode] = useState<'faculty' | 'faculty-courses' | 'courses' | 'ratings' | 'all'>('faculty');
  const [dataImportFile, setDataImportFile] = useState<File | null>(null);
  const [dataImportPreview, setDataImportPreview] = useState<{ mode: string; counts: Record<string, number>; missingCourses: string[]; ambiguousFacultyIds: string[]; ambiguousFacultyMatches: Array<{ sourceId: string; candidates: Array<{ facultyId: string; name: string; school: string }> }>; warnings: string[] } | null>(null);
  const [selectedImportCourses, setSelectedImportCourses] = useState<string[]>([]);
  const [facultyImportResolutions, setFacultyImportResolutions] = useState<Record<string, string>>({});
  const [addMissingRatingFaculty, setAddMissingRatingFaculty] = useState(false);
  const [importConfirmation, setImportConfirmation] = useState('');
  const [finalImportConfirmation, setFinalImportConfirmation] = useState(false);
  const [dataBackups, setDataBackups] = useState<Array<{ backupId: string; createdAt: number; actorId: string; facultyCount: number; courseCount: number }>>([]);
  const [restoreBackupId, setRestoreBackupId] = useState('');
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [finalRestoreConfirmation, setFinalRestoreConfirmation] = useState(false);
  const [adminStatus, setAdminStatus] = useState<{ moderatorLogCount: number; adminLogCount: number; showLogWarning: boolean }>({ moderatorLogCount: 0, adminLogCount: 0, showLogWarning: false });
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
  const [adminSection, setAdminSection] = useState<'menu' | 'faculty-requests' | 'course-requests' | 'manage-menu' | 'manage-faculty' | 'create-faculty' | 'manage-course' | 'create-course'>('menu');
  const [facultyAdminSearch, setFacultyAdminSearch] = useState('');
  const [newFacultyFirstName, setNewFacultyFirstName] = useState('');
  const [newFacultyMiddleName, setNewFacultyMiddleName] = useState('');
  const [newFacultyLastName, setNewFacultyLastName] = useState('');
  const [newFacultySchool, setNewFacultySchool] = useState('');
  const [newFacultyCourseCodes, setNewFacultyCourseCodes] = useState<string[]>([]);
  const [newFacultyCourseSearch, setNewFacultyCourseSearch] = useState('');
  const [newFacultyBusy, setNewFacultyBusy] = useState(false);
  const [courseAdminSearch, setCourseAdminSearch] = useState('');
  const [editingCourseCode, setEditingCourseCode] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [courseAdminBusy, setCourseAdminBusy] = useState(false);
  const [courseAdminMessage, setCourseAdminMessage] = useState('');
  const [courseAdminError, setCourseAdminError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ type: 'faculty'; record: FacultyRecord } | { type: 'course'; code: string; message: string } | null>(null);
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
    questionProvision: '',
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
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/admin/status');
        const result = await response.json() as { status: string; role?: 'owner' | 'admin' | 'none'; moderatorLogCount?: number; adminLogCount?: number; showLogWarning?: boolean };
        if (active && response.ok && result.status === 'success') {
          setAdminRole(result.role ?? 'none');
          setAdminStatus({ moderatorLogCount: result.moderatorLogCount ?? 0, adminLogCount: result.adminLogCount ?? 0, showLogWarning: Boolean(result.showLogWarning) });
        }
      } catch { if (active) setAdminRole('none'); }
    };
    void checkAdmin();
    return () => { active = false; };
  }, []);

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

  const ratingLabels: { key: keyof FacultyRatingSummary['averages']; label: string }[] = [
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
      setModeratorFacultyCourseRequests((current) => current.filter((item) => item.id !== request.id));
      setModeratorFacultyCourseSelection((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      await Promise.all([loadModeratorFacultyCourseRequests(), loadModeratorCourseRequests()]);
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

  const createFacultyDirectly = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFacultyManagementError('');
    setFacultyEditMessage('');
    setNewFacultyBusy(true);
    try {
      const response = await fetch('/api/mod/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: newFacultyFirstName, middleName: newFacultyMiddleName, lastName: newFacultyLastName, school: newFacultySchool, courseCodes: newFacultyCourseCodes }),
      });
      const result = await response.json() as ModerationActionResponse;
      if (!response.ok || result.status !== 'success') throw new Error(result.status === 'error' ? result.message : 'Unable to create faculty.');
      setFacultyEditMessage(result.message);
      setNewFacultyFirstName('');
      setNewFacultyMiddleName('');
      setNewFacultyLastName('');
      setNewFacultySchool('');
      setNewFacultyCourseCodes([]);
      setNewFacultyCourseSearch('');
      await loadAllFacultyForModeration();
    } catch (error) {
      setFacultyManagementError(error instanceof Error ? error.message : 'Unable to create faculty.');
    } finally { setNewFacultyBusy(false); }
  };

  const deleteFacultyDirectly = (record: FacultyRecord) => {
    setFacultyManagementError('');
    setFacultyEditMessage('');
    setPendingDelete({ type: 'faculty', record });
  };

  const loadCoursesForManagement = async () => {
    setCourseAdminError('');
    try {
      const response = await fetch('/api/courses');
      const result = await response.json() as CourseListResponse | ApiErrorResponse;
      if (!response.ok || result.status !== 'success') throw new Error(result.status === 'error' ? result.message : 'Unable to load courses.');
      setAvailableCourses(result.courses);
    } catch (error) {
      setCourseAdminError(error instanceof Error ? error.message : 'Unable to load courses.');
    }
  };

  const saveCourseEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCourseCode) return;
    setCourseAdminBusy(true);
    setCourseAdminError('');
    setCourseAdminMessage('');
    try {
      const response = await fetch(`/api/mod/courses/${encodeURIComponent(editingCourseCode)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: editCourseCode }) });
      const result = await response.json() as ModerationActionResponse;
      if (!response.ok || result.status !== 'success') throw new Error(result.status === 'error' ? result.message : 'Unable to update course.');
      setCourseAdminMessage(result.message);
      setEditingCourseCode('');
      await loadCoursesForManagement();
    } catch (error) { setCourseAdminError(error instanceof Error ? error.message : 'Unable to update course.'); }
    finally { setCourseAdminBusy(false); }
  };

  const createCourseDirectly = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCourseAdminBusy(true);
    setCourseAdminError('');
    setCourseAdminMessage('');
    try {
      const response = await fetch('/api/mod/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: newCourseCode }) });
      const result = await response.json() as ModerationActionResponse;
      if (!response.ok || result.status !== 'success') throw new Error(result.status === 'error' ? result.message : 'Unable to create course.');
      setCourseAdminMessage(result.message);
      setNewCourseCode('');
      await loadCoursesForManagement();
    } catch (error) { setCourseAdminError(error instanceof Error ? error.message : 'Unable to create course.'); }
    finally { setCourseAdminBusy(false); }
  };

  const deleteCourseDirectly = async (code: string) => {
    setCourseAdminBusy(true);
    setCourseAdminError('');
    setCourseAdminMessage('');
    try {
      const response = await fetch(`/api/mod/courses/${encodeURIComponent(code)}/delete`, { method: 'POST' });
      const raw = await response.text();
      let result: ModerationActionResponse | ApiErrorResponse;
      try {
        result = JSON.parse(raw) as ModerationActionResponse | ApiErrorResponse;
      } catch {
        throw new Error(`Delete request failed (HTTP ${response.status}). Server response: ${raw.slice(0, 200) || 'empty response'}`);
      }

      if (response.status === 409 && result.status === 'error') {
        setPendingDelete({ type: 'course', code, message: result.message });
        return;
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.status === 'error' ? result.message : 'Unable to delete course.');
      }
      setCourseAdminMessage(result.message);
      await Promise.all([loadCoursesForManagement(), loadAllFacultyForModeration()]);
    } catch (error) {
      setCourseAdminError(error instanceof Error ? error.message : 'Unable to delete course.');
    } finally {
      setCourseAdminBusy(false);
    }
  };

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);

    if (target.type === 'faculty') {
      setFacultyManagementError('');
      setFacultyEditMessage('');
      setFacultyEditBusy(true);
      try {
        const response = await fetch(`/api/mod/faculty/${encodeURIComponent(target.record.id)}/delete`, { method: 'POST' });
        const raw = await response.text();
        let result: ModerationActionResponse | ApiErrorResponse;
        try {
          result = JSON.parse(raw) as ModerationActionResponse | ApiErrorResponse;
        } catch {
          throw new Error(`Delete request failed (HTTP ${response.status}). Server response: ${raw.slice(0, 200) || 'empty response'}`);
        }
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.status === 'error' ? result.message : 'Unable to delete faculty.');
        }
        setFacultyEditMessage(result.message);
        if (editingFacultyId === target.record.id) setEditingFacultyId('');
        await loadAllFacultyForModeration();
      } catch (error) {
        setFacultyManagementError(error instanceof Error ? error.message : 'Unable to delete faculty.');
      } finally {
        setFacultyEditBusy(false);
      }
      return;
    }

    setCourseAdminBusy(true);
    setCourseAdminError('');
    setCourseAdminMessage('');
    try {
      const response = await fetch(`/api/mod/courses/${encodeURIComponent(target.code)}/delete?confirmAssigned=true`, { method: 'POST' });
      const raw = await response.text();
      let result: ModerationActionResponse | ApiErrorResponse;
      try {
        result = JSON.parse(raw) as ModerationActionResponse | ApiErrorResponse;
      } catch {
        throw new Error(`Delete request failed (HTTP ${response.status}). Server response: ${raw.slice(0, 200) || 'empty response'}`);
      }
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.status === 'error' ? result.message : 'Unable to delete course.');
      }
      setCourseAdminMessage(result.message);
      await Promise.all([loadCoursesForManagement(), loadAllFacultyForModeration()]);
    } catch (error) {
      setCourseAdminError(error instanceof Error ? error.message : 'Unable to delete course.');
    } finally {
      setCourseAdminBusy(false);
    }
  };

  const openAdminConsole = () => {
    setAdminSectionView('overview');
    setAdminMessage('');
    setAdminError('');
    setCurrentView('admin-console');
    void refreshAdminStatus();
  };

  const refreshAdminStatus = async () => {
    try {
      const response = await fetch('/api/admin/status');
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to load admin status.');
      setAdminRole(result.role ?? 'none');
      setAdminStatus({ moderatorLogCount: result.moderatorLogCount ?? 0, adminLogCount: result.adminLogCount ?? 0, showLogWarning: Boolean(result.showLogWarning) });
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Unable to load admin status.');
    }
  };

  const loadAdminUsers = async () => {
    setAdminBusy(true); setAdminError(''); setAdminMessage('');
    try {
      const response = await fetch('/api/admin/admins');
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to load admins.');
      setAdminUsers(result.admins);
    } catch (error) { setAdminError(error instanceof Error ? error.message : 'Unable to load admins.'); }
    finally { setAdminBusy(false); }
  };

  const loadAdminLogs = async (kind: 'moderator' | 'admin' | 'security', page = 1) => {
    setAdminBusy(true); setAdminError(''); setAdminMessage('');
    try {
      const response = await fetch('/api/admin/logs/' + kind + '?page=' + page + '&pageSize=50');
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to load logs.');
      setAdminLogs(result.entries); setAdminLogPage(result.page); setAdminLogTotal(result.total);
    } catch (error) { setAdminError(error instanceof Error ? error.message : 'Unable to load logs.'); }
    finally { setAdminBusy(false); }
  };

  const addAdminUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAdminBusy(true); setAdminError(''); setAdminMessage('');
    try {
      const response = await fetch('/api/admin/admins/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redditUserId: adminTargetId, username: adminTargetUsername }) });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to add admin.');
      setAdminTargetId(''); setAdminTargetUsername(''); setAdminMessage(result.message); await loadAdminUsers(); await refreshAdminStatus();
    } catch (error) { setAdminError(error instanceof Error ? error.message : 'Unable to add admin.'); }
    finally { setAdminBusy(false); }
  };

  const removeAdminUser = async (redditUserId: string) => {
    setAdminBusy(true); setAdminError(''); setAdminMessage('');
    try {
      const response = await fetch('/api/admin/admins/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redditUserId }) });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to remove admin.');
      setPendingAdminRemoval(null);
      setAdminMessage(result.message); await loadAdminUsers(); await refreshAdminStatus();
    } catch (error) { setAdminError(error instanceof Error ? error.message : 'Unable to remove admin.'); }
    finally { setAdminBusy(false); }
  };

  const clearAdminLogs = async () => {
    setAdminBusy(true); setAdminError(''); setAdminMessage('');
    try {
      const response = await fetch('/api/admin/logs/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: adminConfirmText }) });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to clear logs.');
      setAdminConfirmText(''); setAdminMessage(result.message); await refreshAdminStatus();
      if (adminSectionView === 'moderator-logs') await loadAdminLogs('moderator');
      if (adminSectionView === 'admin-logs') await loadAdminLogs('admin');
    } catch (error) { setAdminError(error instanceof Error ? error.message : 'Unable to clear logs.'); }
    finally { setAdminBusy(false); }
  };

  const exportAdminLogs = async () => {
    try {
      const response = await fetch('/api/admin/logs/export');
      if (!response.ok) { const result = await response.json(); throw new Error(result.message || 'Unable to export logs.'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'faculty-ratings-logs.json'; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setAdminError(error instanceof Error ? error.message : 'Unable to export logs.'); }
  };

  const loadDataBackups = async () => {
    setDataTransferBusy(true); setDataTransferError('');
    try {
      const response = await fetch('/api/admin/data/backups'); const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to load recovery backups.');
      setDataBackups(result.backups ?? []);
    } catch (error) { setDataTransferError(error instanceof Error ? error.message : 'Unable to load recovery backups.'); }
    finally { setDataTransferBusy(false); }
  };

  const restoreDataBackup = async () => {
    if (!restoreBackupId || restoreConfirmation !== 'RESTORE' || !finalRestoreConfirmation) return;
    setDataTransferBusy(true); setDataTransferError(''); setDataTransferMessage('');
    try {
      const response = await fetch('/api/admin/data/backups/' + encodeURIComponent(restoreBackupId) + '/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: restoreConfirmation, finalConfirmation: finalRestoreConfirmation }) });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to restore backup.');
      setDataTransferMessage(result.message); setRestoreBackupId(''); setRestoreConfirmation(''); setFinalRestoreConfirmation(false); await loadDataBackups();
    } catch (error) { setDataTransferError(error instanceof Error ? error.message : 'Unable to restore backup.'); }
    finally { setDataTransferBusy(false); }
  };

  const previewDataImport = async () => {
    if (!dataImportFile) { setDataTransferError('Choose a ZIP file first.'); return; }
    setDataTransferBusy(true); setDataTransferError(''); setDataTransferMessage(''); setDataImportPreview(null);
    try {
      const form = new FormData(); form.append('file', dataImportFile); form.append('mode', dataImportMode);
      const response = await fetch('/api/admin/data/import/preview', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to validate import.');
      setDataImportPreview(result); setSelectedImportCourses(result.missingCourses ?? []); setFacultyImportResolutions({}); setImportConfirmation(''); setFinalImportConfirmation(false);
      setDataTransferMessage('Validation completed. Review the preview before importing.');
    } catch (error) { setDataTransferError(error instanceof Error ? error.message : 'Unable to validate import.'); }
    finally { setDataTransferBusy(false); }
  };

  const applyDataImport = async () => {
    if (!dataImportFile || !dataImportPreview) return;
    if (dataImportMode === 'all' && (importConfirmation !== 'CONFIRM' || !finalImportConfirmation)) {
      setDataTransferError('Full replacement requires typing CONFIRM and checking the final confirmation.'); return;
    }
    setDataTransferBusy(true); setDataTransferError(''); setDataTransferMessage('');
    try {
      const form = new FormData(); form.append('file', dataImportFile); form.append('mode', dataImportMode);
      form.append('options', JSON.stringify({ selectedCourses: selectedImportCourses, addMissingFaculty: addMissingRatingFaculty, facultyResolutions: facultyImportResolutions, confirmation: importConfirmation, finalConfirmation: finalImportConfirmation }));
      const response = await fetch('/api/admin/data/import/apply', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Import failed.');
      setDataTransferMessage(result.message || 'Import completed.'); setDataImportPreview(null); setDataImportFile(null); setImportConfirmation(''); setFinalImportConfirmation(false); if (dataImportMode === 'all') await loadDataBackups();
      const fileInput = document.getElementById('data-import-file') as HTMLInputElement | null; if (fileInput) fileInput.value = '';
    } catch (error) { setDataTransferError(error instanceof Error ? error.message : 'Import failed.'); }
    finally { setDataTransferBusy(false); }
  };

  const exportDataArchive = async () => {
    setDataTransferBusy(true); setDataTransferError(''); setDataTransferMessage('');
    try {
      const type = facultyCourseDataOnly ? 'faculty-courses' : dataExportType;
      const query = new URLSearchParams({ type, includeAssignments: String(includeFacultyAssignments) });
      const response = await fetch('/api/admin/data/export?' + query.toString());
      if (!response.ok) {
        const result = await response.json().catch(() => ({ message: 'Unable to export data.' }));
        throw new Error(result.message || 'Unable to export data.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? 'FacultyRatings_Export.zip';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDataTransferMessage('Your ZIP export is ready.');
    } catch (error) {
      setDataTransferError(error instanceof Error ? error.message : 'Unable to export data.');
    } finally { setDataTransferBusy(false); }
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
    <div className="app-page" style={styles.page}>
      <main className="app-container" style={styles.container}>
        {currentView === 'home' && (
          <section className="app-hero" style={{ textAlign: 'center', paddingTop: '8vh' }}>
            <div className="app-eyebrow">VIT BHOPAL <span>•</span> REDDIT COMMUNITY</div>
            <img
              src="/vit-bhopal-logo.png"
              alt="VIT Bhopal University"
              style={{
                display: 'block',
                width: '220px',
                maxWidth: '75%',
                height: '122px',
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)',
                margin: '0 auto 24px',
              }}
            />

            <h1 className="app-display-title" style={styles.title}>Faculty Rating Portal</h1>

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

            </div>

            {!moderatorCheckLoading && isModerator && (
              <div style={{ marginTop: '18px' }}>
                <button
                  style={{ ...styles.button, backgroundColor: '#5265a5' }}
                  onClick={openAdminDashboard}
                >
                  ⚙ Moderator Dashboard
                </button>
              </div>
            )}

            {adminRole !== 'none' && (
              <div style={{ marginTop: '42px' }}>
                <button
                  style={{ ...styles.button, backgroundColor: '#d04422' }}
                  onClick={openAdminConsole}
                >
                  🛡 Admin Dashboard
                </button>
              </div>
            )}
          </section>
        )}

        {currentView === 'faculty' && (
          <section className="app-screen app-screen-directory">
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
            <div
              className="directory-actions"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              <button
                type="button"
                style={styles.button}
                onClick={openRequestForm}
              >
                + Request a Faculty
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={openCourseRequestForm}
              >
                + Request a Course
              </button>
            </div>

            <div className="directory-filters" style={{ display: 'grid', gap: '14px' }}>
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

            <div className="directory-results" style={{ marginTop: '26px' }}>
              {loading && (
                <p style={{ color: '#c6cde2', textAlign: 'center' }}>
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
                    backgroundColor: '#343d68',
                    border: '1px solid #4a5687',
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
                      className="faculty-card"
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
                            <span key={code} style={{ background: '#3a4d7f', border: '1px solid #7695d2', color: '#f2f6ff', borderRadius: '12px', padding: '3px 8px', fontSize: '0.78rem' }}>{code}</span>
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
                            borderColor: record.hasRated ? '#7884ad' : '#6ea8ff',
                            backgroundColor: record.hasRated ? '#424d76' : '#6ea8ff',
                            color: record.hasRated ? '#b5bfdc' : '#fff',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: record.hasRated ? 'not-allowed' : 'pointer',
                            opacity: record.hasRated ? 0.7 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {record.hasRated ? 'Rated' : 'Rate'}
                        </button>
                        <span style={{ color: '#b4d0ff', fontSize: '1.3rem' }}>→</span>
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
                backgroundColor: '#343d68',
                border: '1px solid #4a5687',
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
          <section className="app-screen app-screen-detail">
            <button
              onClick={() => {
                setCurrentView('faculty');
                setShowFacultyCourseRequestEditor(false);
                setFacultyCourseRequestCodes([]);
                setFacultyCourseRequestSearch('');
                setFacultyCourseRequestError('');
                setFacultyCourseRequestMessage('');
              }}
              style={{
                ...styles.secondaryButton,
                padding: '8px 14px',
                marginBottom: '24px',
              }}
            >
              ← Back to Faculty List
            </button>

            <div className="faculty-profile-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ ...styles.title, margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{getFullName(selectedFaculty)}</h1>
              <button
                type="button"
                disabled={Boolean(ratingSummary?.eligibility.hasRated)}
                onClick={() => {
                  if (ratingSummary?.eligibility.hasRated) return;
                  setRatingMode('rate');
                }}
                style={{
                  ...styles.secondaryButton,
                  padding: '8px 16px',
                  flexShrink: 0,
                  borderColor: ratingSummary?.eligibility.hasRated ? '#7884ad' : '#6ea8ff',
                  color: ratingSummary?.eligibility.hasRated ? '#b5bfdc' : '#b4d0ff',
                  backgroundColor: ratingSummary?.eligibility.hasRated ? '#424d76' : 'transparent',
                  cursor: ratingSummary?.eligibility.hasRated ? 'not-allowed' : 'pointer',
                  opacity: ratingSummary?.eligibility.hasRated ? 0.7 : 1,
                }}
              >
                {ratingSummary?.eligibility.hasRated ? 'Rated' : 'Rate'}
              </button>
            </div>
            <p style={styles.subtitle}>School: {selectedFaculty.school}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px', margin: '0 0 18px' }}>
              <strong style={{ fontSize: '0.9rem' }}>Courses:</strong>
              {(selectedFaculty.courseCodes ?? []).length > 0 ? selectedFaculty.courseCodes!.map((code) => (
                <span key={code} style={{ background: '#3a4d7f', border: '1px solid #7695d2', color: '#f2f6ff', borderRadius: '14px', padding: '5px 10px', fontSize: '0.85rem' }}>{code}</span>
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
                          border: '1px solid #1d2442',
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

              <div style={{ borderTop: '1px solid #596795', paddingTop: '16px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <strong>Does this faculty provide Questions?</strong>
                  <span style={styles.muted}>
                    {Object.values(ratingSummary?.questionProvisionCounts ?? { no: 0, sometimes: 0, yes: 0 }).reduce((sum, value) => sum + value, 0)} responses
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                  {([
                    { value: 'no', label: 'No', color: '#e07862' },
                    { value: 'sometimes', label: 'Sometimes', color: '#e2b85c' },
                    { value: 'yes', label: 'Yes', color: '#65c99a' },
                  ] as const).map((option) => {
                    const counts = ratingSummary?.questionProvisionCounts ?? { no: 0, sometimes: 0, yes: 0 };
                    const total = counts.no + counts.sometimes + counts.yes;
                    const count = counts[option.value];
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={option.value} style={{ background: '#252d50', border: '1px solid #596795', borderRadius: '12px', padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ color: option.color, fontSize: '0.9rem', fontWeight: 700 }}>{option.label}</div>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, margin: '4px 0' }}>{count}</div>
                        <div style={{ height: '5px', background: '#414b72', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: percentage + '%', background: option.color, borderRadius: '99px' }} />
                        </div>
                        <div style={{ ...styles.muted, fontSize: '0.75rem', marginTop: '5px' }}>{percentage}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                      <legend style={styles.label}>Does this faculty provide Questions?</legend>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                        {([
                          { value: 'no', label: 'No' },
                          { value: 'sometimes', label: 'Sometimes' },
                          { value: 'yes', label: 'Yes' },
                        ] as const).map((option) => {
                          const selected = ratingValues.questionProvision === option.value;
                          return (
                            <label key={option.value} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '7px',
                              minHeight: '48px',
                              padding: '8px 5px',
                              borderRadius: '12px',
                              border: selected ? '2px solid #8bb8ff' : '1px solid #596795',
                              background: selected ? '#3b4b78' : '#252d50',
                              color: '#ffffff',
                              cursor: 'pointer',
                              fontSize: 'clamp(0.78rem, 2.5vw, 0.95rem)',
                              boxSizing: 'border-box',
                            }}>
                              <input
                                type="radio"
                                required
                                name="questionProvision"
                                value={option.value}
                                checked={selected}
                                onChange={() => setRatingValues((current) => ({ ...current, questionProvision: option.value }))}
                                style={{ accentColor: '#8bb8ff', margin: 0 }}
                              />
                              <span>{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
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
          <section className="app-screen app-screen-form">
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
                  backgroundColor: '#343d68',
                  border: '1px solid #4a5687',
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
                        <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#3a4d7f', border: '1px solid #7695d2', borderRadius: '18px', padding: '6px 10px' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px', background: '#2f385f', borderRadius: '8px' }}>
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
          <section className="app-screen app-screen-form">
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
          <section className="app-screen app-screen-admin">
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

            <h1 style={{ ...styles.title, fontSize: '2.15rem', marginBottom: '8px' }}>Moderator Dashboard</h1>

            <p style={{ ...styles.subtitle, marginBottom: '24px', maxWidth: '620px' }}>
              Manage submissions, review course additions, and maintain the faculty directory.
            </p>

            {adminSection === 'menu' && (
              <div className="admin-menu-grid" style={{ display: 'grid', gap: '14px', marginTop: '22px' }}>
                <button type="button" className="admin-menu-card" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '9px', minHeight: '126px' }} onClick={() => { setAdminSection('faculty-requests'); void loadModeratorRequests(); }}>
                  <strong style={{ fontSize: '1.1rem' }}>Pending Faculty Requests</strong>
                  <span style={{ ...styles.muted, marginTop: '7px' }}>{moderatorRequests.length ? `${moderatorRequests.length} pending request(s)` : 'No pending requests'}</span>
                  <span style={{ color: '#b4d0ff', marginTop: '10px' }}>Open requests →</span>
                </button>
                <button type="button" className="admin-menu-card" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '9px', minHeight: '126px' }} onClick={() => { setAdminSection('course-requests'); void loadModeratorCourseRequests(); void loadModeratorFacultyCourseRequests(); }}>
                  <strong style={{ fontSize: '1.1rem' }}>Pending Course Requests</strong>
                  <span style={{ ...styles.muted, marginTop: '7px' }}>{moderatorCourseRequests.length + moderatorFacultyCourseRequests.length ? `${moderatorCourseRequests.length + moderatorFacultyCourseRequests.length} pending request(s)` : 'No pending requests'}</span>
                  <span style={{ color: '#b4d0ff', marginTop: '10px' }}>Open requests →</span>
                </button>
                <button type="button" className="admin-menu-card" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '22px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '9px', minHeight: '126px' }} onClick={() => setAdminSection('manage-menu')}>
                  <strong style={{ fontSize: '1.1rem' }}>Manage Faculty &amp; Courses</strong>
                  <span style={{ ...styles.muted, marginTop: '7px' }}>Create, edit, and delete directory entries</span>
                  <span style={{ color: '#b4d0ff', marginTop: '10px' }}>Open management →</span>
                </button>
              </div>
            )}

            {adminSection !== 'menu' && (
              <button type="button" style={{ ...styles.secondaryButton, marginBottom: '18px', padding: '8px 14px' }} onClick={() => setAdminSection(adminSection === 'manage-menu' || adminSection === 'manage-faculty' || adminSection === 'create-faculty' || adminSection === 'manage-course' || adminSection === 'create-course' ? (adminSection === 'manage-menu' ? 'menu' : 'manage-menu') : 'menu')}>← {adminSection === 'manage-menu' ? 'Dashboard' : ['manage-faculty','create-faculty','manage-course','create-course'].includes(adminSection) ? 'Manage Faculty & Courses' : 'Dashboard'}</button>
            )}

            {adminSection === 'manage-menu' && (
              <div className="admin-menu-grid" style={{ display: 'grid', gap: '14px', marginTop: '10px' }}>
                <button type="button" className="admin-menu-card" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '20px', display: 'grid', gap: '8px' }} onClick={() => { setAdminSection('manage-faculty'); void loadAllFacultyForModeration(); }}>
                  <strong>Manage Faculty</strong><span style={styles.muted}>Edit or delete existing faculty members</span>
                </button>
                <button type="button" className="admin-menu-card" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '20px', display: 'grid', gap: '8px' }} onClick={() => { setAdminSection('create-faculty'); void loadAvailableCourses(); }}>
                  <strong>Create Faculty</strong><span style={styles.muted}>Add a faculty member directly to the directory</span>
                </button>
                <button type="button" className="admin-menu-card" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '20px', display: 'grid', gap: '8px' }} onClick={() => { setAdminSection('manage-course'); void loadCoursesForManagement(); }}>
                  <strong>Manage Course</strong><span style={styles.muted}>Edit or delete existing courses</span>
                </button>
                <button type="button" className="admin-menu-card" style={{ ...styles.card, cursor: 'pointer', textAlign: 'left', padding: '20px', display: 'grid', gap: '8px' }} onClick={() => { setAdminSection('create-course'); setCourseAdminMessage(''); setCourseAdminError(''); }}>
                  <strong>Create Course</strong><span style={styles.muted}>Add a course directly to the directory</span>
                </button>
              </div>
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
                                <span key={code} style={{ background: '#3a4d7f', border: '1px solid #7695d2', color: '#f2f6ff', borderRadius: '14px', padding: '4px 9px', fontSize: '0.85rem' }}>{code}</span>
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
                            borderTop: '1px solid #56618d',
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
                                  <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3a4d7f', border: '1px solid #7695d2', borderRadius: '16px', padding: '5px 9px' }}>
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
                            borderTop: '1px solid #56618d',
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

            {adminSection === 'manage-faculty' && (
              <>
            <div style={{ borderTop: '1px solid #56618d', marginTop: '30px', paddingTop: '24px' }}>
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
                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                      <button type="button" style={{ ...styles.secondaryButton, padding: '7px 12px' }} onClick={() => openFacultyEditor(record)}>Edit</button>
                      <button type="button" style={{ ...styles.secondaryButton, padding: '7px 12px', borderColor: '#d04444', color: '#ff9999' }} onClick={() => void deleteFacultyDirectly(record)}>Delete</button>
                    </div>
                  </div>
                  {editingFacultyId === record.id && (
                    <form onSubmit={saveFacultyEdit} style={{ display: 'grid', gap: '10px', borderTop: '1px solid #56618d', paddingTop: '12px' }}>
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
                          <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#3a4d7f', border: '1px solid #7695d2', borderRadius: '15px', padding: '5px 9px' }}>
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

            {adminSection === 'create-faculty' && (
              <section style={{ ...styles.card, display: 'grid', gap: '12px' }}>
                <h2 style={{ margin: 0 }}>Create Faculty</h2>
                {facultyEditMessage && <p role="status" style={{ color: '#8de0ad' }}>{facultyEditMessage}</p>}
                {facultyManagementError && <p role="alert" style={{ color: '#ffb3b3' }}>{facultyManagementError}</p>}
                <form onSubmit={createFacultyDirectly} style={{ display: 'grid', gap: '10px' }}>
                  <label style={styles.label}>First Name *</label><input style={styles.input} value={newFacultyFirstName} onChange={e=>setNewFacultyFirstName(e.target.value)} maxLength={60} required />
                  <label style={styles.label}>Middle Name</label><input style={styles.input} value={newFacultyMiddleName} onChange={e=>setNewFacultyMiddleName(e.target.value)} maxLength={60} />
                  <label style={styles.label}>Last Name *</label><input style={styles.input} value={newFacultyLastName} onChange={e=>setNewFacultyLastName(e.target.value)} maxLength={60} required />
                  <label style={styles.label}>School *</label><select style={styles.input} value={newFacultySchool} onChange={e=>setNewFacultySchool(e.target.value)} required><option value="">Select a school</option>{SCHOOLS.map(s=><option key={s} value={s}>{s}</option>)}</select>
                  <label style={styles.label}>Assigned Courses (Optional)</label>
                  <input style={styles.input} placeholder="Search approved course codes..." value={newFacultyCourseSearch} onChange={e=>setNewFacultyCourseSearch(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7))} />
                  <div style={{display:'flex',flexWrap:'wrap',gap:'7px'}}>{newFacultyCourseCodes.map(code=><span key={code} style={{background:'#3a4d7f',padding:'5px 9px',borderRadius:'15px'}}>{code} <button type="button" onClick={()=>setNewFacultyCourseCodes(v=>v.filter(x=>x!==code))}>×</button></span>)}</div>
                  {availableCourses.filter(course=>!newFacultyCourseCodes.includes(course.code)).filter(course=>!newFacultyCourseSearch||course.code.includes(newFacultyCourseSearch)).slice(0,12).map(course=><button key={course.code} type="button" style={{...styles.secondaryButton,textAlign:'left'}} onClick={()=>setNewFacultyCourseCodes(v=>[...v,course.code])}>+ {course.code}</button>)}
                  <button type="submit" style={styles.button} disabled={newFacultyBusy}>{newFacultyBusy?'Creating...':'Create Faculty'}</button>
                </form>
              </section>
            )}
            {adminSection === 'manage-course' && (
              <section style={{display:'grid',gap:'12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}><h2 style={{margin:0}}>Manage Courses ({availableCourses.length})</h2><button type="button" style={{...styles.secondaryButton,padding:'8px 12px'}} onClick={()=>void loadCoursesForManagement()}>Refresh</button></div>
                {courseAdminMessage && <p role="status" style={{color:'#8de0ad'}}>{courseAdminMessage}</p>}
                {courseAdminError && <p role="alert" style={{color:'#ffb3b3'}}>{courseAdminError}</p>}
                <input style={styles.input} placeholder="Search course code..." value={courseAdminSearch} onChange={e=>setCourseAdminSearch(e.target.value.toUpperCase())}/>
                {availableCourses.filter(course=>course.code.includes(courseAdminSearch.trim())).map(course=><article key={course.code} style={{...styles.card,display:'grid',gap:'10px'}}>
                  {editingCourseCode===course.code ? <form onSubmit={saveCourseEdit} style={{display:'flex',gap:'8px',flexWrap:'wrap'}}><input style={{...styles.input,flex:'1 1 180px'}} value={editCourseCode} onChange={e=>setEditCourseCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7))} required/><button type="submit" style={styles.button} disabled={courseAdminBusy}>Save</button><button type="button" style={styles.secondaryButton} onClick={()=>setEditingCourseCode('')}>Cancel</button></form> : <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}><strong>{course.code}</strong><div style={{display:'flex',gap:'7px'}}><button type="button" style={{...styles.secondaryButton,padding:'7px 12px'}} onClick={()=>{setEditingCourseCode(course.code);setEditCourseCode(course.code)}}>Edit</button><button type="button" style={{...styles.secondaryButton,padding:'7px 12px',borderColor:'#d04444',color:'#ff9999'}} onClick={()=>void deleteCourseDirectly(course.code)} disabled={courseAdminBusy}>Delete</button></div></div>}
                </article>)}
              </section>
            )}
            {adminSection === 'create-course' && (
              <section style={{...styles.card,display:'grid',gap:'12px'}}>
                <h2 style={{margin:0}}>Create Course</h2>
                {courseAdminMessage && <p role="status" style={{color:'#8de0ad'}}>{courseAdminMessage}</p>}
                {courseAdminError && <p role="alert" style={{color:'#ffb3b3'}}>{courseAdminError}</p>}
                <form onSubmit={createCourseDirectly} style={{display:'grid',gap:'10px'}}>
                  <label style={styles.label}>Course Code *</label>
                  <input style={styles.input} value={newCourseCode} onChange={e=>setNewCourseCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7))} placeholder="MAT1001" pattern="[A-Z]{3}[0-9]{4}" required/>
                  <p style={styles.muted}>Enter three letters followed by four digits.</p>
                  <button type="submit" style={styles.button} disabled={courseAdminBusy}>{courseAdminBusy?'Creating...':'Create Course'}</button>
                </form>
              </section>
            )}
            {adminSection === 'course-requests' && (
              <>
            <div style={{ borderTop: '1px solid #56618d', marginTop: '30px', paddingTop: '24px' }}>
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
                    <div style={{ borderTop: '1px solid #56618d', paddingTop: '12px', display: 'grid', gap: '10px' }}>
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
      {currentView === 'admin-console' && (
        <section className="app-screen app-screen-admin" style={{ display: 'grid', gap: '16px' }}>
          <button onClick={goHome} style={{ ...styles.secondaryButton, justifySelf: 'start' }}>← Back to Home</button>
          <h1 style={{ ...styles.title, marginBottom: 0 }}>Admin Dashboard</h1>
          <p style={styles.subtitle}>Owner and approved-admin controls. Protected security audit records are owner-only.</p>
          {adminError && <p role="alert" style={{ color: '#ffb3b3' }}>{adminError}</p>}
          {adminMessage && <p role="status" style={{ color: '#8de0ad' }}>{adminMessage}</p>}
          {adminStatus.showLogWarning && adminRole === 'owner' && (
            <div role="alert" style={{ ...styles.card, border: '1px solid #d89a37', color: '#ffd58a' }}>
              <strong>Log storage warning</strong>
              <p>At least one log has reached 5,000 entries. Export the logs and clear the normal logs when appropriate. The protected security audit log is not cleared.</p>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button style={styles.secondaryButton} onClick={() => { setAdminSectionView('overview'); void refreshAdminStatus(); }}>Overview</button>
            {adminRole === 'owner' && <button style={styles.secondaryButton} onClick={() => { setAdminSectionView('admins'); void loadAdminUsers(); }}>Manage Admins</button>}
            <button style={styles.secondaryButton} onClick={() => { setAdminSectionView('moderator-logs'); void loadAdminLogs('moderator'); }}>Moderator Logs</button>
            <button style={styles.secondaryButton} onClick={() => { setAdminSectionView('admin-logs'); void loadAdminLogs('admin'); }}>Admin Logs</button>
            {adminRole === 'owner' && <button style={styles.secondaryButton} onClick={() => { setAdminSectionView('security-logs'); void loadAdminLogs('security'); }}>Security Audit</button>}
            <button style={styles.secondaryButton} onClick={() => { setAdminSectionView('data-export'); setDataTransferError(''); setDataTransferMessage(''); }}>Data Export</button>
            <button style={styles.secondaryButton} onClick={() => { setAdminSectionView('data-import'); setDataTransferError(''); setDataTransferMessage(''); void loadDataBackups(); }}>Data Import</button>
          </div>
          {adminSectionView === 'overview' && (
            <div style={{ ...styles.card, display: 'grid', gap: '12px' }}>
              <h2 style={{ margin: 0 }}>Log overview</h2>
              <p style={{ margin: 0 }}>Moderator logs: {adminStatus.moderatorLogCount.toLocaleString()}</p>
              <p style={{ margin: 0 }}>Admin logs: {adminStatus.adminLogCount.toLocaleString()}</p>
              <p style={styles.muted}>Logs are retained until the owner clears them. The security audit log is retained separately and is never removed by normal log clearing.</p>
              {adminRole === 'owner' && <button style={styles.secondaryButton} onClick={() => void exportAdminLogs()}>Export Logs (JSON)</button>}
            </div>
          )}
          {adminSectionView === 'data-export' && (
            <div style={{ ...styles.card, display: 'grid', gap: '14px' }}>
              <h2 style={{ margin: 0 }}>Export App Data</h2>
              <p style={styles.muted}>Download selected records as a ZIP containing CSV files and JSON metadata. Reddit voter IDs are never included; individual ratings remain anonymous.</p>
              <label style={styles.label}>Dataset</label>
              <select style={styles.input} value={dataExportType} onChange={event => { setDataExportType(event.target.value as typeof dataExportType); setFacultyCourseDataOnly(false); }}>
                <option value="faculty">Faculty Data</option>
                <option value="courses">Course List</option>
                <option value="ratings">Faculty Ratings</option>
                <option value="all">All Data</option>
              </select>
              {dataExportType === 'faculty' && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '9px' }}><input type="checkbox" checked={includeFacultyAssignments && !facultyCourseDataOnly} disabled={facultyCourseDataOnly} onChange={event => setIncludeFacultyAssignments(event.target.checked)} /> Include Faculty Course Assignments</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '9px' }}><input type="checkbox" checked={facultyCourseDataOnly} onChange={event => setFacultyCourseDataOnly(event.target.checked)} /> Faculty Course Data Only (faculty details and assigned course codes)</label>
                </>
              )}
              <div style={{ borderTop: '1px solid #56618d', paddingTop: '14px', display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Recovery Backups</h3>
                  <button type="button" style={styles.secondaryButton} onClick={() => void loadDataBackups()} disabled={dataTransferBusy}>Refresh Backups</button>
                </div>
                <p style={styles.muted}>Full replacements automatically create retained backups. Restoring one first creates a backup of the current data.</p>
                {dataBackups.map(backup => <article key={backup.backupId} style={{ ...styles.card, display: 'grid', gap: '7px' }}>
                  <strong>{new Date(backup.createdAt).toLocaleString()}</strong>
                  <span style={styles.muted}>{backup.facultyCount} faculty · {backup.courseCount} courses · Backup {backup.backupId}</span>
                  <button type="button" style={{ ...styles.secondaryButton, borderColor: '#d89a37', color: '#ffd58a' }} onClick={() => { setRestoreBackupId(backup.backupId); setRestoreConfirmation(''); setFinalRestoreConfirmation(false); }}>Prepare Restore</button>
                </article>)}
                {!dataBackups.length && <p style={styles.muted}>No recovery backups are currently available.</p>}
                {restoreBackupId && (
                  <div style={{ border: '1px solid #b83232', borderRadius: '10px', padding: '12px', display: 'grid', gap: '9px' }}>
                    <strong style={{ color: '#ffaaaa' }}>Restore selected backup?</strong>
                    <p style={styles.muted}>This replaces the current faculty, course and rating datasets with the selected backup. Admins, owner identity, security settings and logs are preserved.</p>
                    <label style={styles.label}>Type RESTORE</label>
                    <input style={styles.input} value={restoreConfirmation} onChange={event => setRestoreConfirmation(event.target.value)} placeholder="RESTORE" />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={finalRestoreConfirmation} onChange={event => setFinalRestoreConfirmation(event.target.checked)} /> I understand this replaces the current data.</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" style={styles.secondaryButton} onClick={() => setRestoreBackupId('')}>Cancel</button>
                      <button type="button" style={{ ...styles.button, backgroundColor: '#a63838' }} disabled={dataTransferBusy || restoreConfirmation !== 'RESTORE' || !finalRestoreConfirmation} onClick={() => void restoreDataBackup()}>{dataTransferBusy ? 'Restoring...' : 'Restore Backup'}</button>
                    </div>
                  </div>
                )}
              </div>
              {dataTransferError && <p role="alert" style={{ color: '#ffb3b3', margin: 0 }}>{dataTransferError}</p>}
              {dataTransferMessage && <p role="status" style={{ color: '#8de0ad', margin: 0 }}>{dataTransferMessage}</p>}
              <p style={styles.muted}>ZIP files are limited to 4.5 MB to stay below the app request-size constraints. If an export is too large, export smaller datasets separately.</p>
              <button type="button" style={styles.button} onClick={() => void exportDataArchive()} disabled={dataTransferBusy}>{dataTransferBusy ? 'Preparing ZIP...' : 'Download ZIP Export'}</button>
            </div>
          )}
          {adminSectionView === 'data-import' && (
            <div style={{ ...styles.card, display: 'grid', gap: '14px' }}>
              <h2 style={{ margin: 0 }}>Import App Data</h2>
              <p style={styles.muted}>Only ZIP archives exported by Faculty Ratings schema version 1 are accepted. Uploads are limited to 4.5 MB; the archive is validated before any records are changed.</p>
              <label style={styles.label}>Import Mode</label>
              <select style={styles.input} value={dataImportMode} onChange={event => { setDataImportMode(event.target.value as typeof dataImportMode); setDataImportPreview(null); }}>
                <option value="faculty">Faculty Data</option>
                <option value="faculty-courses">Faculty Course Details Only</option>
                <option value="courses">Course List</option>
                <option value="ratings">Faculty Ratings (Anonymous)</option>
                <option value="all">All Data (Full Replacement)</option>
              </select>
              <label style={styles.label}>ZIP Archive</label>
              <input id="data-import-file" style={styles.input} type="file" accept=".zip,application/zip" onChange={event => { setDataImportFile(event.target.files?.[0] ?? null); setDataImportPreview(null); }} />
              <button type="button" style={styles.secondaryButton} onClick={() => void previewDataImport()} disabled={dataTransferBusy || !dataImportFile}>{dataTransferBusy ? 'Validating...' : 'Validate & Preview'}</button>
              {dataImportPreview && (
                <div style={{ borderTop: '1px solid #56618d', paddingTop: '14px', display: 'grid', gap: '10px' }}>
                  <h3 style={{ margin: 0 }}>Import Preview</h3>
                  {Object.entries(dataImportPreview.counts).map(([label, value]) => <p key={label} style={{ margin: 0 }}>{label.replace(/([A-Z])/g, ' $1')}: <strong>{value.toLocaleString()}</strong></p>)}
                  {dataImportPreview.warnings.map(warning => <p key={warning} style={{ color: '#ffd58a', margin: 0 }}>{warning}</p>)}
                  {dataImportPreview.missingCourses.length > 0 && (
                    <div style={{ display: 'grid', gap: '7px' }}>
                      <strong>Missing courses — selected by default</strong>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" style={styles.secondaryButton} onClick={() => setSelectedImportCourses(dataImportPreview.missingCourses)}>Select All</button>
                        <button type="button" style={styles.secondaryButton} onClick={() => setSelectedImportCourses([])}>Unselect All</button>
                      </div>
                      {dataImportPreview.missingCourses.map(code => <label key={code} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={selectedImportCourses.includes(code)} onChange={event => setSelectedImportCourses(current => event.target.checked ? [...current, code] : current.filter(item => item !== code))} />{code}</label>)}
                    </div>
                  )}
                  {dataImportPreview.ambiguousFacultyMatches.length > 0 && (
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <strong>Resolve ambiguous faculty matches</strong>
                      {dataImportPreview.ambiguousFacultyMatches.map(item => <label key={item.sourceId} style={{ display: 'grid', gap: '6px' }}><span>{item.sourceId}</span><select style={styles.input} value={facultyImportResolutions[item.sourceId] ?? ''} onChange={event => setFacultyImportResolutions(current => ({ ...current, [item.sourceId]: event.target.value }))}><option value="">Choose destination faculty</option>{item.candidates.map(candidate => <option key={candidate.facultyId} value={candidate.facultyId}>{candidate.name} ({candidate.school}) — {candidate.facultyId}</option>)}</select></label>)}
                    </div>
                  )}
                  {dataImportMode === 'ratings' && <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={addMissingRatingFaculty} onChange={event => setAddMissingRatingFaculty(event.target.checked)} /> Add faculty details when no matching destination faculty exists</label>}
                  {dataImportMode === 'all' && (
                    <div style={{ border: '1px solid #b83232', borderRadius: '10px', padding: '12px', display: 'grid', gap: '10px' }}>
                      <strong style={{ color: '#ffaaaa' }}>Full replacement — destructive operation</strong>
                      <p style={styles.muted}>This replaces faculty, courses, assignments and ratings. A backup is created first. Owner/admin access, security settings and all logs are preserved. Approved admins are permitted to run this operation.</p>
                      <label style={styles.label}>Type CONFIRM</label>
                      <input style={styles.input} value={importConfirmation} onChange={event => setImportConfirmation(event.target.value)} placeholder="CONFIRM" />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={finalImportConfirmation} onChange={event => setFinalImportConfirmation(event.target.checked)} /> I understand this replaces the current app data.</label>
                    </div>
                  )}
                  <button type="button" style={{ ...styles.button, backgroundColor: dataImportMode === 'all' ? '#a63838' : '#23834c' }} onClick={() => void applyDataImport()} disabled={dataTransferBusy || dataImportPreview.ambiguousFacultyMatches.some(item => !facultyImportResolutions[item.sourceId]) || (dataImportMode === 'all' && (importConfirmation !== 'CONFIRM' || !finalImportConfirmation))}>{dataTransferBusy ? 'Importing...' : dataImportMode === 'all' ? 'Confirm Full Replacement' : 'Import Selected Data'}</button>
                </div>
              )}
              {dataTransferError && <p role="alert" style={{ color: '#ffb3b3', margin: 0 }}>{dataTransferError}</p>}
              {dataTransferMessage && <p role="status" style={{ color: '#8de0ad', margin: 0 }}>{dataTransferMessage}</p>}
            </div>
          )}
          {adminSectionView === 'admins' && adminRole === 'owner' && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <form onSubmit={addAdminUser} style={{ ...styles.card, display: 'grid', gap: '10px' }}>
                <h2 style={{ margin: 0 }}>Add Approved Admin</h2>
                <label style={styles.label}>Reddit User ID</label><input style={styles.input} value={adminTargetId} onChange={e => setAdminTargetId(e.target.value)} placeholder="Reddit user ID" required />
                <label style={styles.label}>Reddit Username</label><input style={styles.input} value={adminTargetUsername} onChange={e => setAdminTargetUsername(e.target.value)} placeholder="username" required />
                <button style={styles.button} type="submit" disabled={adminBusy}>Add Admin</button>
              </form>
              <div style={{ display: 'grid', gap: '8px' }}>
                {adminUsers.map(user => <article key={user.id} style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}><div><strong>u/{user.username}</strong><p style={styles.muted}>{user.id}</p></div><button style={{ ...styles.secondaryButton, borderColor: '#d04444', color: '#ff9999' }} disabled={adminBusy} onClick={() => setPendingAdminRemoval({ id: user.id, username: user.username })}>Remove</button></article>)}
                {!adminBusy && adminUsers.length === 0 && <p style={styles.muted}>No additional admins have been approved.</p>}
              </div>
            </div>
          )}
          {(adminSectionView === 'moderator-logs' || adminSectionView === 'admin-logs' || adminSectionView === 'security-logs') && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0 }}>{adminSectionView === 'moderator-logs' ? 'Moderator Logs' : adminSectionView === 'admin-logs' ? 'Admin Logs' : 'Protected Security Audit'}</h2>
                <span style={styles.muted}>{adminLogTotal.toLocaleString()} entries</span>
              </div>
              {adminLogs.map(entry => <article key={entry.id} style={{ ...styles.card, display: 'grid', gap: '5px' }}><strong>{entry.action}</strong><span style={styles.muted}>u/{entry.actorUsername} · {formatDate(entry.timestamp)} · {entry.result}</span><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0, fontSize: '0.82rem' }}>{JSON.stringify(entry.details, null, 2)}</pre></article>)}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button style={styles.secondaryButton} disabled={adminBusy || adminLogPage <= 1} onClick={() => void loadAdminLogs(adminSectionView === 'moderator-logs' ? 'moderator' : adminSectionView === 'admin-logs' ? 'admin' : 'security', adminLogPage - 1)}>Previous</button>
                <span style={styles.muted}>Page {adminLogPage} / {Math.max(1, Math.ceil(adminLogTotal / 50))}</span>
                <button style={styles.secondaryButton} disabled={adminBusy || adminLogPage * 50 >= adminLogTotal} onClick={() => void loadAdminLogs(adminSectionView === 'moderator-logs' ? 'moderator' : adminSectionView === 'admin-logs' ? 'admin' : 'security', adminLogPage + 1)}>Next</button>
              </div>
              {adminRole === 'owner' && adminSectionView !== 'security-logs' && (
                <div style={{ ...styles.card, display: 'grid', gap: '8px' }}>
                  <strong>Clear normal logs</strong>
                  <p style={styles.muted}>This clears moderator and admin logs only. The protected security audit log remains intact.</p>
                  <input style={styles.input} value={adminConfirmText} onChange={e => setAdminConfirmText(e.target.value)} placeholder="Type CONFIRM" />
                  <button style={{ ...styles.button, backgroundColor: '#a63838' }} disabled={adminBusy || adminConfirmText !== 'CONFIRM'} onClick={() => void clearAdminLogs()}>Clear Logs</button>
                  <button style={styles.secondaryButton} onClick={() => void exportAdminLogs()}>Export Logs (JSON)</button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {pendingAdminRemoval && (
        <div
          role="presentation"
          onClick={() => setPendingAdminRemoval(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'grid', placeItems: 'center', padding: '20px', background: 'rgba(0, 0, 0, 0.72)' }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-remove-confirmation-title"
            onClick={(event) => event.stopPropagation()}
            style={{ width: 'min(100%, 440px)', display: 'grid', gap: '16px', padding: '22px', border: '1px solid #6575a8', borderRadius: '16px', background: '#202747', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.45)' }}
          >
            <h2 id="admin-remove-confirmation-title" style={{ margin: 0 }}>Remove approved admin?</h2>
            <p style={{ margin: 0, lineHeight: 1.55 }}>u/{pendingAdminRemoval.username} will immediately lose Admin Dashboard access. This does not affect their subreddit moderator permissions.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" style={styles.secondaryButton} onClick={() => setPendingAdminRemoval(null)} disabled={adminBusy}>Cancel</button>
              <button type="button" style={{ ...styles.button, backgroundColor: '#b83232' }} onClick={() => void removeAdminUser(pendingAdminRemoval.id)} disabled={adminBusy}>
                {adminBusy ? 'Removing...' : 'Remove Admin'}
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingDelete && (
        <div
          role="presentation"
          onClick={() => setPendingDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            background: 'rgba(0, 0, 0, 0.72)',
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(100%, 480px)',
              display: 'grid',
              gap: '16px',
              padding: '22px',
              border: '1px solid #6575a8',
              borderRadius: '16px',
              background: '#202747',
              color: '#fff',
              boxShadow: '0 20px 60px rgba(0,0,0,.45)',
            }}
          >
            <h2 id="delete-confirmation-title" style={{ margin: 0 }}>Confirm deletion</h2>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
              {pendingDelete.type === 'faculty'
                ? `Delete ${getFullName(pendingDelete.record)} and all of their ratings? This cannot be undone.`
                : pendingDelete.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" style={styles.secondaryButton} onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                style={{ ...styles.button, backgroundColor: '#b83232' }}
                onClick={() => void confirmPendingDelete()}
                disabled={facultyEditBusy || courseAdminBusy}
              >
                {facultyEditBusy || courseAdminBusy ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const rootElement =
  document.getElementById('root') || document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(<App />);
}