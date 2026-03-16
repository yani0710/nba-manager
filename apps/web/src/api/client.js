import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Error handler
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const api = {
  // Saves
  saves: {
    getAll: () => client.get('/saves'),
    getById: (id) => client.get(`/saves/${id}`),
    getDashboard: (id) => client.get(`/saves/${id}/dashboard`),
    getSchedule: (id, params = {}) => client.get(`/saves/${id}/schedule`, { params }),
    getResults: (id) => client.get(`/saves/${id}/results`),
    getResultDetails: (id, gameId) => client.get(`/saves/${id}/results/${gameId}`),
    getStandings: (id) => client.get(`/saves/${id}/standings`),
    getNextMatch: (id) => client.get(`/saves/${id}/next-match`),
    getInbox: (id, params = {}) => client.get(`/saves/${id}/inbox`, { params }),
    readInboxMessage: (id, msgId) => client.post(`/saves/${id}/inbox/${msgId}/read`),
    respondInboxMessage: (id, msgId, data) => client.post(`/saves/${id}/inbox/${msgId}/respond`, data),
    deleteInboxMessage: (id, msgId) => client.delete(`/saves/${id}/inbox/${msgId}`),
    saveRotation: (id, data) => client.post(`/saves/${id}/rotation`, data),
    saveTactics: (id, data) => client.post(`/saves/${id}/tactics`, data),
    getTraining: (id) => client.get(`/saves/${id}/training`),
    saveTrainingPlan: (id, data) => client.post(`/saves/${id}/training`, data),
    getPlayerTrainingPlans: (id) => client.get(`/saves/${id}/training/players`),
    savePlayerTrainingPlan: (id, data) => client.post(`/saves/${id}/training/players`, data),
    deletePlayerTrainingPlan: (id, playerId) => client.delete(`/saves/${id}/training/players/${playerId}`),
    create: (data) => client.post('/saves', data),
    advance: (id, data = {}) => client.post(`/saves/${id}/advance`, data),
    delete: (id) => client.delete(`/saves/${id}`),
  },

  coaches: {
    getPresets: () => client.get('/coaches/presets'),
  },

  // Teams
  teams: {
    getAll: (params = {}) => client.get('/teams', { params }),
    getById: (id, params = {}) => client.get(`/teams/${id}`, { params }),
    getRoster: (id, params = {}) => client.get(`/teams/${id}/roster`, { params }),
  },

  // Players
  players: {
    getAll: (params = {}) => client.get('/players', { params }),
    getById: (id, params = {}) => client.get(`/players/${id}`, { params }),
    getStats: (id, params = {}) => client.get(`/players/${id}/stats`, { params }),
    getByTeam: (teamId, params = {}) => client.get(`/players/team/${teamId}`, { params }),
  },

  // Games
  games: {
    getAll: () => client.get('/games'),
    getById: (id) => client.get(`/games/${id}`),
    getUpcoming: (limit = 10) => client.get('/games/upcoming', { params: { limit } }),
  },

  // Transfers
  transfers: {
    getAll: (params = {}) => client.get('/transfers', { params }),
    create: (data) => client.post('/transfers', data),
    send: (id, data) => client.post(`/transfers/${id}/send`, data),
    respondToProposal: (proposalId, data) => client.post(`/transfers/proposals/${proposalId}/respond`, data),
  },
};

