import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, AppBar, Toolbar, Typography, Container } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';

// Import components
import DoctorInterface from './components/DoctorInterface';
import SessionList from './components/SessionList';
import SessionView from './components/SessionView';

// Create theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

function App() {
  const [currentSession, setCurrentSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Session management functions
  const createNewSession = (sessionData) => {
    setCurrentSession(sessionData);
    setSessions(prev => [sessionData, ...prev]);
  };

  const updateSession = (id, updates) => { // FIX: Use a generic 'id' parameter
    setCurrentSession(prev => 
      // FIX: Compare with prev._id
      prev && prev._id === id 
        ? { ...prev, ...updates }
        : prev
    );
    
    setSessions(prev => 
      prev.map(session => 
        // FIX: Compare with session._id
        session._id === id 
          ? { ...session, ...updates }
          : session
      )
    );
  };

  const endCurrentSession = async () => { // Make the function async
    if (currentSession) {
      try {
        const response = await fetch(`/api/sessions/${currentSession._id}/end`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });
  
        if (response.ok) {
          const endedSessionData = await response.json();
          
          // Update local state with final data from server
          updateSession(currentSession._id, { 
            status: 'completed',
            endTime: endedSessionData.session.endTime,
            duration: endedSessionData.session.duration
          });
          
          setCurrentSession(null);
          toast.success('Session ended successfully.');
        } else {
          toast.error('Failed to end the session on the server.');
        }
      } catch (error) {
        console.error('Error ending session:', error);
        toast.error('An error occurred while ending the session.');
      }
    }
  };

  // Load sessions on app start
  useEffect(() => {
    const loadSessions = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/sessions?limit=10');
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {/* Header */}
          <AppBar position="static" elevation={1}>
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Acko MER AI - Medical Transcription System
              </Typography>
              {currentSession && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2">
                    Active Session: {currentSession.sessionId}
                  </Typography>
                  <Box 
                    sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      backgroundColor: 'success.main',
                      animation: 'pulse 2s infinite'
                    }} 
                  />
                </Box>
              )}
            </Toolbar>
          </AppBar>

          {/* Main Content */}
          <Container maxWidth="xl" sx={{ flex: 1, py: 3 }}>
            <Routes>
              {/* Main Interface */}
              <Route 
                path="/" 
                element={
                  <DoctorInterface
                    currentSession={currentSession}
                    onSessionCreate={createNewSession}
                    onSessionUpdate={updateSession}
                    onSessionEnd={endCurrentSession}
                    recentSessions={sessions.slice(0, 5)}
                  />
                } 
              />
              
              {/* Sessions List */}
              <Route 
                path="/sessions" 
                element={
                  <SessionList 
                    sessions={sessions}
                    loading={loading}
                    onSessionSelect={(session) => setCurrentSession(session)}
                  />
                } 
              />
              
              {/* Individual Session View */}
              <Route 
                path="/sessions/:sessionId" 
                element={
                  <SessionView 
                    onSessionUpdate={updateSession}
                  />
                } 
              />
              
              {/* Redirect unknown routes to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Container>

          {/* Toast Notifications */}
          <ToastContainer
            position="bottom-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;