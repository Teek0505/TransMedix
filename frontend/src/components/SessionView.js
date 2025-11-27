import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

const SessionView = ({ onSessionUpdate }) => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      
      // Load session details
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setSession(sessionData);
      }

      // Load transcriptions
      const transcriptionsResponse = await fetch(`/api/sessions/${sessionId}/transcriptions`);
      if (transcriptionsResponse.ok) {
        const transcriptionsData = await transcriptionsResponse.json();
        setTranscriptions(transcriptionsData.transcriptions || []);
      }

      // Load summary
      const summaryResponse = await fetch(`/api/sessions/${sessionId}/summary`);
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
      }

    } catch (error) {
      setError('Failed to load session data');
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
        >
          Back to Main
        </Button>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Session not found
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
        >
          Back to Main
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
        >
          Back
        </Button>
        <Typography variant="h4">
          Session Details
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Session Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Session Information
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Session ID:</Typography>
                <Typography variant="body1">{session.sessionId}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Doctor:</Typography>
                <Typography variant="body1">{session.doctorName}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Status:</Typography>
                <Chip 
                  label={session.status} 
                  color={getStatusColor(session.status)}
                  size="small"
                />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Type:</Typography>
                <Typography variant="body1">{session.sessionType}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Priority:</Typography>
                <Typography variant="body1">{session.priority}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Started:</Typography>
                <Typography variant="body1">{formatDate(session.startTime)}</Typography>
              </Box>
              
              {session.endTime && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Ended:</Typography>
                  <Typography variant="body1">{formatDate(session.endTime)}</Typography>
                </Box>
              )}
              
              {session.duration && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Duration:</Typography>
                  <Typography variant="body1">{session.duration} minutes</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Transcriptions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transcriptions ({transcriptions.length})
              </Typography>
              
              {transcriptions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No transcriptions available
                </Typography>
              ) : (
                <List>
                  {transcriptions.slice(0, 5).map((transcription, index) => (
                    <React.Fragment key={transcription.transcriptionId}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={transcription.transcriptionText.substring(0, 100) + '...'}
                          secondary={`Confidence: ${transcription.confidence}% | ${formatDate(transcription.createdAt)}`}
                        />
                      </ListItem>
                      {index < transcriptions.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                  {transcriptions.length > 5 && (
                    <ListItem sx={{ px: 0 }}>
                      <Typography variant="body2" color="text.secondary">
                        ... and {transcriptions.length - 5} more
                      </Typography>
                    </ListItem>
                  )}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Summary */}
        {summary && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Session Summary
                </Typography>
                
                {summary.content && (
                  <Box>
                    {summary.content.chiefComplaint && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="primary">Chief Complaint:</Typography>
                        <Typography variant="body2">{summary.content.chiefComplaint}</Typography>
                      </Box>
                    )}
                    
                    {summary.content.assessment && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="primary">Assessment:</Typography>
                        <Typography variant="body2">{summary.content.assessment}</Typography>
                      </Box>
                    )}
                    
                    {summary.content.plan && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="primary">Plan:</Typography>
                        <Typography variant="body2">{summary.content.plan}</Typography>
                      </Box>
                    )}
                  </Box>
                )}
                
                {summary.status && (
                  <Box sx={{ mt: 2 }}>
                    <Chip 
                      label={`Status: ${summary.status}`} 
                      variant="outlined" 
                      size="small" 
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default SessionView;
