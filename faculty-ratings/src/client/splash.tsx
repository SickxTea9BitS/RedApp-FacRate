
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  FacultyListResponse,
  FacultyRecord,
  FacultyRequestSubmissionResponse,
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

type View = 'home' | 'faculty' | 'faculty-detail' | 'request';
type RatingMode = 'rate' | 'check';

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
    cursor: 'pointer',
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

export const App = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const [ratingMode, setRatingMode] = useState<RatingMode>('rate');
  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
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
  }, [currentView, search, selectedSchool]);

  const openFacultyList = (mode: RatingMode) => {
    setRatingMode(mode);
    setSearch('');
    setSelectedSchool('');
    setSelectedFaculty(null);
    setCurrentView('faculty');
  };

  const openRequestForm = () => {
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
  };

  const getFullName = (record: FacultyRecord) =>
    [record.firstName, record.middleName, record.lastName]
      .filter(Boolean)
      .join(' ');

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
                style={styles.button}
                onClick={() => openFacultyList('rate')}
              >
                Rate a Faculty
              </button>

              <button
                style={styles.secondaryButton}
                onClick={() => openFacultyList('check')}
              >
                Check Faculty Rating
              </button>
            </div>
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
              {ratingMode === 'rate' ? 'Rate a Faculty' : 'Faculty Ratings'}
            </h1>

            <p style={styles.subtitle}>
              Search for a faculty member or filter by school.
            </p>

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
                    <button
                      key={record.id}
                      style={styles.card}
                      onClick={() => {
                        setSelectedFaculty(record);
                        setCurrentView('faculty-detail');
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '1.05rem' }}>
                            {getFullName(record)}
                          </strong>

                          <p
                            style={{
                              ...styles.muted,
                              marginBottom: 0,
                              marginTop: '7px',
                            }}
                          >
                            School: {record.school}
                          </p>
                        </div>

                        <span style={{ color: '#38aaff', fontSize: '1.3rem' }}>
                          →
                        </span>
                      </div>
                    </button>
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

            <p style={styles.subtitle}>
              School: {selectedFaculty.school}
            </p>

            <div
              style={{
                backgroundColor: '#252526',
                border: '1px solid #383838',
                borderRadius: '10px',
                padding: '22px',
              }}
            >
              <h3>
                {ratingMode === 'rate'
                  ? 'Submit a Faculty Rating'
                  : 'Faculty Rating Summary'}
              </h3>

              <p style={styles.muted}>
                The rating system will be implemented in Phase 4.
              </p>
            </div>
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
                    onChange={(event) =>
                      setRequestSchool(event.target.value)
                    }
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
      </main>
    </div>
  );
};

const rootElement =
  document.getElementById('root') || document.getElementById('app');

if (rootElement) {
  createRoot(rootElement).render(<App />);
}
