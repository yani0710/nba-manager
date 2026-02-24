import { create } from 'zustand';
import { api } from '../api/client';

export const useGameStore = create((set, get) => ({
  saves: [],
  currentSave: null,
  coachPresets: [],
  teams: [],
  players: [],
  squadPlayers: [],
  scheduleGames: [],
  results: [],
  selectedResult: null,
  standings: { east: [], west: [] },
  nextMatchScouting: null,
  dashboard: null,
  inbox: { total: 0, unread: 0, take: 30, skip: 0, messages: [] },
  selectedPlayer: null,
  playerTrainingPlans: [],
  trainingConfig: null,
  loading: false,
  error: null,

  // Saves actions
  fetchSaves: async () => {
    set({ loading: true });
    try {
      const { data } = await api.saves.getAll();
      set({ saves: data, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  createSave: async (payload) => {
    try {
      const request = typeof payload === 'string'
        ? { name: payload, description: `Save: ${payload}` }
        : payload;

      const { data } = await api.saves.create(request);
      set((state) => ({ saves: [...state.saves, data], currentSave: data }));
      await get().fetchDashboard();
      await get().fetchInbox();
      await get().fetchSchedule();
      await get().fetchResults();
      await get().fetchStandings();
      await get().fetchNextMatchScouting();
      await get().fetchPlayerTrainingPlans();
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  loadSave: async (id) => {
    try {
      const { data } = await api.saves.getById(id);
      set({ currentSave: data });
      await get().fetchDashboard();
      await get().fetchInbox();
      await get().fetchSchedule();
      await get().fetchResults();
      await get().fetchStandings();
      await get().fetchNextMatchScouting();
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  advanceSave: async (id) => {
    try {
      const { data } = await api.saves.advance(id);
      set({ currentSave: data });
      await get().fetchPlayers();
      await get().fetchDashboard();
      await get().fetchInbox();
      await get().fetchSchedule();
      await get().fetchResults();
      await get().fetchStandings();
      await get().fetchNextMatchScouting();
      return data;
    } catch (error) {
      set({ error: error.message });
    }
  },

  advanceDays: async (days = 1) => {
    const save = get().currentSave;
    if (!save) return;
    set({ loading: true });
    try {
      let latestSave = save;
      for (let i = 0; i < days; i += 1) {
        const { data } = await api.saves.advance(latestSave.id);
        latestSave = data;
      }
      set({ currentSave: latestSave });
      await get().fetchPlayers();
      await get().fetchDashboard();
      await get().fetchInbox();
      await get().fetchSchedule();
      await get().fetchStandings();
      await get().fetchNextMatchScouting();
      await get().fetchResults();
      await get().fetchPlayerTrainingPlans();
      return latestSave;
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  // Teams actions
  fetchTeams: async () => {
    set({ loading: true });
    try {
      const saveId = get().currentSave?.id;
      const { data } = await api.teams.getAll(saveId ? { saveId } : {});
      set({ teams: data, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  // Players actions
  fetchPlayers: async () => {
    set({ loading: true });
    try {
      const saveId = get().currentSave?.id;
      const { data } = await api.players.getAll(saveId ? { saveId } : {});
      set({ players: data, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchSquad: async () => {
    const save = get().currentSave;
    const teams = get().teams;
    if (!save) return;

    const teamCode = save?.data?.career?.teamShortName;
    if (!teamCode) {
      set({ squadPlayers: [] });
      return;
    }

    let team = teams.find((t) => t.shortName === teamCode);
    if (!team) {
      await get().fetchTeams();
      team = get().teams.find((t) => t.shortName === teamCode);
    }
    if (!team) return;

    set({ loading: true });
    try {
      const saveId = get().currentSave?.id;
      const { data } = await api.players.getByTeam(team.id, saveId ? { saveId } : {});
      set({ squadPlayers: data, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchSchedule: async () => {
    const save = get().currentSave;
    if (!save) return;

    set({ loading: true });
    try {
      const { data } = await api.saves.getSchedule(save.id);
      set({ scheduleGames: data, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchResults: async () => {
    const save = get().currentSave;
    if (!save) return;
    try {
      const { data } = await api.saves.getResults(save.id);
      set({ results: data, error: null });
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchResultDetails: async (gameId) => {
    const save = get().currentSave;
    if (!save) return null;
    try {
      const { data } = await api.saves.getResultDetails(save.id, gameId);
      set({ selectedResult: data, error: null });
      return data;
    } catch (error) {
      set({ error: error.message });
      return null;
    }
  },

  fetchDashboard: async () => {
    const save = get().currentSave;
    if (!save) return;
    try {
      const { data } = await api.saves.getDashboard(save.id);
      set({ dashboard: data, error: null });
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchStandings: async () => {
    const save = get().currentSave;
    if (!save) return;
    try {
      const { data } = await api.saves.getStandings(save.id);
      set({ standings: data, error: null });
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchNextMatchScouting: async () => {
    const save = get().currentSave;
    if (!save) return;
    try {
      const { data } = await api.saves.getNextMatch(save.id);
      set({ nextMatchScouting: data, error: null });
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchInbox: async (params = {}) => {
    const save = get().currentSave;
    if (!save) return;
    try {
      const take = Number.isFinite(params.take) ? params.take : (get().inbox?.take ?? 30);
      const skip = Number.isFinite(params.skip) ? params.skip : (get().inbox?.skip ?? 0);
      const { data } = await api.saves.getInbox(save.id, { take, skip });
      set((state) => ({
        inbox: data,
        currentSave: state.currentSave
          ? {
              ...state.currentSave,
              data: {
                ...(state.currentSave.data || {}),
                inboxUnread: data?.unread ?? 0,
              },
            }
          : state.currentSave,
        error: null,
      }));
    } catch (error) {
      set({ error: error.message });
    }
  },

  markInboxRead: async (msgId) => {
    const save = get().currentSave;
    if (!save) return;
    await api.saves.readInboxMessage(save.id, msgId);
    await get().fetchInbox({ take: get().inbox?.take ?? 30, skip: get().inbox?.skip ?? 0 });
    await get().fetchDashboard();
  },

  deleteInboxMessage: async (msgId) => {
    const save = get().currentSave;
    if (!save) return;
    await api.saves.deleteInboxMessage(save.id, msgId);
    const take = get().inbox?.take ?? 30;
    const skip = get().inbox?.skip ?? 0;
    const totalAfterDelete = Math.max(0, (get().inbox?.total ?? 1) - 1);
    const adjustedSkip = skip >= totalAfterDelete && skip > 0
      ? Math.max(0, skip - take)
      : skip;
    await get().fetchInbox({ take, skip: adjustedSkip });
    await get().fetchDashboard();
  },

  saveRotation: async (rotation) => {
    const save = get().currentSave;
    if (!save) return;
    await api.saves.saveRotation(save.id, { rotation });
    const { data } = await api.saves.getById(save.id);
    set({ currentSave: data });
  },

  saveTactics: async (tactics) => {
    const save = get().currentSave;
    if (!save) return;
    await api.saves.saveTactics(save.id, { tactics });
    const { data } = await api.saves.getById(save.id);
    set({ currentSave: data });
  },

  saveTrainingPlan: async (trainingPlan) => {
    const save = get().currentSave;
    if (!save) return;
    await api.saves.saveTrainingPlan(save.id, { trainingPlan });
    const { data } = await api.saves.getById(save.id);
    set({ currentSave: data });
  },

  saveTrainingConfig: async ({ trainingPlan, weekPlan, playerPlans }) => {
    const save = get().currentSave;
    if (!save) return;
    await api.saves.saveTrainingPlan(save.id, { trainingPlan, weekPlan, playerPlans });
    const { data } = await api.saves.getById(save.id);
    set({ currentSave: data });
  },

  fetchTrainingConfig: async () => {
    const save = get().currentSave;
    if (!save) return null;
    try {
      const { data } = await api.saves.getTraining(save.id);
      set((state) => ({
        trainingConfig: data,
        currentSave: state.currentSave
          ? {
              ...state.currentSave,
              data: {
                ...(state.currentSave.data || {}),
                trainingPlan: data.trainingPlan,
                training: {
                  ...(state.currentSave.data?.training || {}),
                  ...(data.training || {}),
                },
              },
            }
          : state.currentSave,
        error: null,
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
      return null;
    }
  },

  fetchPlayerTrainingPlans: async () => {
    const save = get().currentSave;
    if (!save) return [];
    try {
      const { data } = await api.saves.getPlayerTrainingPlans(save.id);
      set({ playerTrainingPlans: data, error: null });
      return data;
    } catch (error) {
      set({ error: error.message });
      return [];
    }
  },

  upsertPlayerTrainingPlan: async ({ playerId, focus, intensity }) => {
    const save = get().currentSave;
    if (!save) return null;
    try {
      const { data } = await api.saves.savePlayerTrainingPlan(save.id, { playerId, focus, intensity });
      await get().fetchPlayerTrainingPlans();
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deletePlayerTrainingPlan: async (playerId) => {
    const save = get().currentSave;
    if (!save) return null;
    try {
      const { data } = await api.saves.deletePlayerTrainingPlan(save.id, playerId);
      await get().fetchPlayerTrainingPlans();
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  fetchCoachPresets: async () => {
    try {
      const { data } = await api.coaches.getPresets();
      set({ coachPresets: data, error: null });
    } catch (error) {
      set({ error: error.message });
    }
  },

  setSelectedPlayer: (player) => set({ selectedPlayer: player }),
}));
