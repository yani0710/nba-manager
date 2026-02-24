import { CreateSaveDto } from "./saves.dto";
type SavePayload = {
    season?: string;
    week?: number;
    status?: string;
    currentDate?: string;
    inboxUnread?: number;
    manager?: {
        name?: string;
        username?: string;
        coachAvatar?: string;
    };
    career?: {
        teamShortName?: string | null;
        unemployed?: boolean;
    };
    injuries?: Array<{
        playerName: string;
        injury: string;
        expectedReturnWeeks: number;
    }>;
    training?: {
        rating: number;
        trend: "up" | "steady" | "down";
        teamProfiles?: Array<{
            id: string;
            name: string;
            intensity: "low" | "balanced" | "high";
            focus: "shooting" | "defense" | "fitness" | "balanced";
            restDay?: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
        }>;
        activeTeamProfileId?: string;
        weekPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
            intensity: "low" | "balanced" | "high";
            focus: "shooting" | "defense" | "fitness" | "balanced";
        }>>;
        playerPlans?: Record<string, {
            intensity: "low" | "balanced" | "high";
            focus: "shooting" | "defense" | "fitness" | "balanced";
            targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
        }>;
    };
    trainingPlan?: {
        intensity: "low" | "balanced" | "high";
        focus: "shooting" | "defense" | "fitness" | "balanced";
    };
    tactics?: {
        pace: "slow" | "balanced" | "fast";
        threePtFocus: number;
        defenseScheme: "drop" | "switch" | "press";
        board?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
            playerId: number | null;
            x: number;
            y: number;
        }>>;
    };
    playerState?: Record<string, {
        fatigue: number;
        morale: number;
        form: number;
        effectiveOverall?: number;
        formHistory?: number[];
        gamesSinceDrift?: number;
        gamesPlayed?: number;
    }>;
    teamState?: Record<string, {
        form: number;
        last5: string;
        streak: number;
        offenseRating: number;
        defenseRating: number;
    }>;
    rotation?: {
        PG?: number | null;
        SG?: number | null;
        SF?: number | null;
        PF?: number | null;
        C?: number | null;
    };
};
type StandingsRow = {
    teamId: number;
    team: string;
    shortName: string;
    conference: string;
    division: string;
    wins: number;
    losses: number;
    pct: number;
    gb: number;
    streak: string;
};
export declare class SavesService {
    createSave(dto: CreateSaveDto): Promise<{
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: number | null;
        teamId: number | null;
        description: string | null;
        currentDate: Date;
        season: string;
        coachName: string | null;
        coachAvatarId: string | null;
        version: number;
        coachProfileId: number | null;
        managedTeamId: number | null;
    }>;
    getSaveById(id: number): Promise<{
        team: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        } | null;
        coachProfile: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            displayName: string;
            avatarId: string;
            reputation: number;
            preferredStyle: string | null;
            userId: number | null;
        } | null;
    } & {
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: number | null;
        teamId: number | null;
        description: string | null;
        currentDate: Date;
        season: string;
        coachName: string | null;
        coachAvatarId: string | null;
        version: number;
        coachProfileId: number | null;
        managedTeamId: number | null;
    }>;
    getAllSaves(): Promise<({
        team: {
            name: string;
            shortName: string;
        } | null;
        coachProfile: {
            displayName: string;
            avatarId: string;
        } | null;
    } & {
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: number | null;
        teamId: number | null;
        description: string | null;
        currentDate: Date;
        season: string;
        coachName: string | null;
        coachAvatarId: string | null;
        version: number;
        coachProfileId: number | null;
        managedTeamId: number | null;
    })[]>;
    getSaveCoreState(id: number): Promise<{
        id: number;
        name: string;
        description: string | null;
        season: string;
        currentDate: Date;
        version: number;
        teamId: number | null;
        managedTeamId: number | null;
        coachName: string | null;
        coachAvatarId: string | null;
        team: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        } | null;
        coachProfile: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            displayName: string;
            avatarId: string;
            reputation: number;
            preferredStyle: string | null;
            userId: number | null;
        } | null;
        inboxCount: number;
        nextMatch: ({
            awayTeam: {
                id: number;
                name: string;
                shortName: string;
                nbaTeamId: number | null;
                city: string;
                createdAt: Date;
                updatedAt: Date;
                conference: string | null;
                division: string | null;
                primaryColor: string | null;
                secondaryColor: string | null;
                logoKey: string | null;
                logoPath: string | null;
                form: number;
                morale: number;
            };
            homeTeam: {
                id: number;
                name: string;
                shortName: string;
                nbaTeamId: number | null;
                city: string;
                createdAt: Date;
                updatedAt: Date;
                conference: string | null;
                division: string | null;
                primaryColor: string | null;
                secondaryColor: string | null;
                logoKey: string | null;
                logoPath: string | null;
                form: number;
                morale: number;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            saveId: number | null;
            homeTeamId: number;
            awayTeamId: number;
            homeScore: number;
            awayScore: number;
            gameDate: Date;
        }) | null;
        lastResult: ({
            awayTeam: {
                id: number;
                name: string;
                shortName: string;
                nbaTeamId: number | null;
                city: string;
                createdAt: Date;
                updatedAt: Date;
                conference: string | null;
                division: string | null;
                primaryColor: string | null;
                secondaryColor: string | null;
                logoKey: string | null;
                logoPath: string | null;
                form: number;
                morale: number;
            };
            homeTeam: {
                id: number;
                name: string;
                shortName: string;
                nbaTeamId: number | null;
                city: string;
                createdAt: Date;
                updatedAt: Date;
                conference: string | null;
                division: string | null;
                primaryColor: string | null;
                secondaryColor: string | null;
                logoKey: string | null;
                logoPath: string | null;
                form: number;
                morale: number;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            saveId: number | null;
            homeTeamId: number;
            awayTeamId: number;
            homeScore: number;
            awayScore: number;
            gameDate: Date;
        }) | null;
        data: {
            inboxUnread: number;
            season?: string;
            week?: number;
            status?: string;
            currentDate?: string;
            manager?: {
                name?: string;
                username?: string;
                coachAvatar?: string;
            };
            career?: {
                teamShortName?: string | null;
                unemployed?: boolean;
            };
            injuries?: Array<{
                playerName: string;
                injury: string;
                expectedReturnWeeks: number;
            }>;
            training?: {
                rating: number;
                trend: "up" | "steady" | "down";
                teamProfiles?: Array<{
                    id: string;
                    name: string;
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                    restDay?: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
                }>;
                activeTeamProfileId?: string;
                weekPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                }>>;
                playerPlans?: Record<string, {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                    targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
                }>;
            };
            trainingPlan?: {
                intensity: "low" | "balanced" | "high";
                focus: "shooting" | "defense" | "fitness" | "balanced";
            };
            tactics?: {
                pace: "slow" | "balanced" | "fast";
                threePtFocus: number;
                defenseScheme: "drop" | "switch" | "press";
                board?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                    playerId: number | null;
                    x: number;
                    y: number;
                }>>;
            };
            playerState?: Record<string, {
                fatigue: number;
                morale: number;
                form: number;
                effectiveOverall?: number;
                formHistory?: number[];
                gamesSinceDrift?: number;
                gamesPlayed?: number;
            }>;
            teamState?: Record<string, {
                form: number;
                last5: string;
                streak: number;
                offenseRating: number;
                defenseRating: number;
            }>;
            rotation?: {
                PG?: number | null;
                SG?: number | null;
                SF?: number | null;
                PF?: number | null;
                C?: number | null;
            };
        };
        createdAt: Date;
        updatedAt: Date;
    }>;
    advanceSave(id: number): Promise<{
        team: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        } | null;
        coachProfile: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            displayName: string;
            avatarId: string;
            reputation: number;
            preferredStyle: string | null;
            userId: number | null;
        } | null;
    } & {
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: number | null;
        teamId: number | null;
        description: string | null;
        currentDate: Date;
        season: string;
        coachName: string | null;
        coachAvatarId: string | null;
        version: number;
        coachProfileId: number | null;
        managedTeamId: number | null;
    }>;
    advanceSaveToDate(id: number, targetDate: string): Promise<{
        team: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        } | null;
        coachProfile: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            displayName: string;
            avatarId: string;
            reputation: number;
            preferredStyle: string | null;
            userId: number | null;
        } | null;
    } & {
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: number | null;
        teamId: number | null;
        description: string | null;
        currentDate: Date;
        season: string;
        coachName: string | null;
        coachAvatarId: string | null;
        version: number;
        coachProfileId: number | null;
        managedTeamId: number | null;
    }>;
    deleteSave(id: number): Promise<{
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: number | null;
        teamId: number | null;
        description: string | null;
        currentDate: Date;
        season: string;
        coachName: string | null;
        coachAvatarId: string | null;
        version: number;
        coachProfileId: number | null;
        managedTeamId: number | null;
    }>;
    getInbox(id: number, take?: number, skip?: number): Promise<{
        total: number;
        unread: number;
        take: number;
        skip: number;
        messages: {
            id: string;
            subject: string;
            body: string;
            from: string;
            createdAt: string;
            type: string;
            read: boolean;
        }[];
    }>;
    getSchedule(id: number, from?: string, to?: string): Promise<({
        awayTeam: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        };
        homeTeam: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        };
    } & {
        id: number;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        saveId: number | null;
        homeTeamId: number;
        awayTeamId: number;
        homeScore: number;
        awayScore: number;
        gameDate: Date;
    })[]>;
    getResults(id: number): Promise<{
        id: number;
        gameDate: Date;
        homeTeam: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        };
        awayTeam: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        };
        homeScore: number;
        awayScore: number;
        status: string;
    }[]>;
    getResultDetails(id: number, gameId: number): Promise<{
        id: number;
        gameDate: Date;
        homeTeam: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        };
        awayTeam: {
            id: number;
            name: string;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            createdAt: Date;
            updatedAt: Date;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
            form: number;
            morale: number;
        };
        homeScore: number;
        awayScore: number;
        playerOfTheMatch: {
            playerId: number;
            name: string;
            teamShortName: string;
            points: number;
            rebounds: number;
            assists: number;
        } | null;
        topScorer: {
            playerId: number;
            name: string;
            teamShortName: string;
            points: number;
        } | null;
        basicStats: {
            home: {
                points: number;
                rebounds: number;
                assists: number;
            };
            away: {
                points: number;
                rebounds: number;
                assists: number;
            };
        };
        players: {
            playerId: number;
            name: string;
            teamShortName: string;
            points: number;
            rebounds: number;
            assists: number;
        }[];
    }>;
    getStandings(id: number): Promise<{
        east: StandingsRow[];
        west: StandingsRow[];
    }>;
    markInboxMessageRead(saveId: number, msgId: number): Promise<{
        success: boolean;
        unread: number;
        messageId: number;
    }>;
    deleteInboxMessage(saveId: number, msgId: number): Promise<{
        success: boolean;
        unread: number;
        deletedMessageId: number;
    }>;
    saveRotation(saveId: number, rotation: SavePayload["rotation"]): Promise<{
        success: boolean;
        rotation: {
            PG?: number | null;
            SG?: number | null;
            SF?: number | null;
            PF?: number | null;
            C?: number | null;
        };
    }>;
    saveTactics(saveId: number, tactics: Partial<NonNullable<SavePayload["tactics"]>>): Promise<{
        success: boolean;
        tactics: {
            pace: "slow" | "balanced" | "fast";
            threePtFocus: number;
            defenseScheme: "drop" | "switch" | "press";
            board?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                playerId: number | null;
                x: number;
                y: number;
            }>>;
        };
    }>;
    saveTrainingPlan(saveId: number, payload: {
        trainingPlan?: Partial<NonNullable<SavePayload["trainingPlan"]>>;
        weekPlan?: NonNullable<NonNullable<SavePayload["training"]>["weekPlan"]>;
        playerPlans?: NonNullable<NonNullable<SavePayload["training"]>["playerPlans"]>;
        teamProfiles?: NonNullable<NonNullable<SavePayload["training"]>["teamProfiles"]>;
        activeTeamProfileId?: string;
    }): Promise<{
        success: boolean;
        trainingPlan: {
            intensity: "low" | "balanced" | "high";
            focus: "shooting" | "defense" | "fitness" | "balanced";
        };
        training: {
            rating: number;
            trend: "up" | "steady" | "down";
            teamProfiles?: Array<{
                id: string;
                name: string;
                intensity: "low" | "balanced" | "high";
                focus: "shooting" | "defense" | "fitness" | "balanced";
                restDay?: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
            }>;
            activeTeamProfileId?: string;
            weekPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                intensity: "low" | "balanced" | "high";
                focus: "shooting" | "defense" | "fitness" | "balanced";
            }>>;
            playerPlans?: Record<string, {
                intensity: "low" | "balanced" | "high";
                focus: "shooting" | "defense" | "fitness" | "balanced";
                targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
            }>;
        };
    }>;
    getTrainingConfig(saveId: number): Promise<{
        success: boolean;
        trainingPlan: {
            intensity: "low" | "balanced" | "high";
            focus: "shooting" | "defense" | "fitness" | "balanced";
        };
        training: {
            rating: number;
            trend: "up" | "steady" | "down";
            teamProfiles: {
                id: string;
                name: string;
                intensity: "low" | "balanced" | "high";
                focus: "shooting" | "defense" | "fitness" | "balanced";
                restDay?: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
            }[];
            activeTeamProfileId: string | null;
            weekPlan: {
                Mon: {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                };
                Tue: {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                };
                Wed: {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                };
                Thu: {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                };
                Fri: {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                };
                Sat: {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                };
                Sun: {
                    intensity: "low" | "balanced" | "high";
                    focus: "shooting" | "defense" | "fitness" | "balanced";
                };
            };
        };
        currentDate: string;
        saveId: number;
    }>;
    getPlayerTrainingPlans(saveId: number): Promise<{
        id: string;
        saveId: number;
        playerId: number;
        focus: string;
        intensity: string;
        createdAt: Date;
        updatedAt: Date;
        player: {
            id: number;
            name: string;
            team: {
                id: number;
                name: string;
                shortName: string;
            };
            pos: string;
            overallBase: number;
            overallCurrent: number;
            form: number;
            fatigue: number;
        };
    }[]>;
    upsertPlayerTrainingPlan(saveId: number, payload: {
        playerId: number;
        focus: string;
        intensity: string;
    }): Promise<{
        success: boolean;
        plan: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            intensity: string;
            focus: string;
            playerId: number;
            saveId: number;
        };
    }>;
    deletePlayerTrainingPlan(saveId: number, playerId: number): Promise<{
        success: boolean;
    }>;
    getNextMatchScouting(saveId: number): Promise<{
        gameId: number;
        date: Date;
        venue: string;
        opponent: {
            id: number;
            name: string;
            shortName: string;
        };
        managedTeam: {
            id: number;
            name: string;
            shortName: string;
        };
        probableStarters: {
            managed: {
                id: number;
                name: string;
                position: string;
            }[];
            opponent: {
                id: number;
                name: string;
                position: string;
            }[];
        };
        last5: {
            managed: ("W" | "L")[];
            opponent: ("W" | "L")[];
        };
    } | null>;
    getDashboardSummary(id: number): Promise<{
        nextMatch: ({
            awayTeam: {
                id: number;
                name: string;
                shortName: string;
                nbaTeamId: number | null;
                city: string;
                createdAt: Date;
                updatedAt: Date;
                conference: string | null;
                division: string | null;
                primaryColor: string | null;
                secondaryColor: string | null;
                logoKey: string | null;
                logoPath: string | null;
                form: number;
                morale: number;
            };
            homeTeam: {
                id: number;
                name: string;
                shortName: string;
                nbaTeamId: number | null;
                city: string;
                createdAt: Date;
                updatedAt: Date;
                conference: string | null;
                division: string | null;
                primaryColor: string | null;
                secondaryColor: string | null;
                logoKey: string | null;
                logoPath: string | null;
                form: number;
                morale: number;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            saveId: number | null;
            homeTeamId: number;
            awayTeamId: number;
            homeScore: number;
            awayScore: number;
            gameDate: Date;
        }) | null;
        recentResults: ({
            awayTeam: {
                id: number;
                name: string;
                shortName: string;
                nbaTeamId: number | null;
                city: string;
                createdAt: Date;
                updatedAt: Date;
                conference: string | null;
                division: string | null;
                primaryColor: string | null;
                secondaryColor: string | null;
                logoKey: string | null;
                logoPath: string | null;
                form: number;
                morale: number;
            };
            homeTeam: {
                id: number;
                name: string;
                shortName: string;
                nbaTeamId: number | null;
                city: string;
                createdAt: Date;
                updatedAt: Date;
                conference: string | null;
                division: string | null;
                primaryColor: string | null;
                secondaryColor: string | null;
                logoKey: string | null;
                logoPath: string | null;
                form: number;
                morale: number;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            saveId: number | null;
            homeTeamId: number;
            awayTeamId: number;
            homeScore: number;
            awayScore: number;
            gameDate: Date;
        })[];
        standings: StandingsRow[];
        leaders: {
            name: string;
            value: number;
            metric: string;
        }[];
        inbox: {
            unread: number;
            latest: {
                id: string;
                subject: string;
                body: string;
                from: string;
                createdAt: string;
                read: boolean;
            }[];
        };
        injuries: {
            playerName: string;
            injury: string;
            expectedReturnWeeks: number;
        }[];
        training: {
            rating: number;
            trend: "up" | "steady" | "down";
            teamProfiles?: Array<{
                id: string;
                name: string;
                intensity: "low" | "balanced" | "high";
                focus: "shooting" | "defense" | "fitness" | "balanced";
                restDay?: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
            }>;
            activeTeamProfileId?: string;
            weekPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                intensity: "low" | "balanced" | "high";
                focus: "shooting" | "defense" | "fitness" | "balanced";
            }>>;
            playerPlans?: Record<string, {
                intensity: "low" | "balanced" | "high";
                focus: "shooting" | "defense" | "fitness" | "balanced";
                targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
            }>;
        };
        teamState: Record<string, {
            form: number;
            last5: string;
            streak: number;
            offenseRating: number;
            defenseRating: number;
        }>;
    }>;
    private buildConferenceStandings;
    private withGamesBack;
    private normalizeConference;
    private computeStreak;
    private getDefaultProbableStarters;
    private getManagedProbableStarters;
    private getTeamLastFive;
    private applyDailyTrainingEffects;
    private isPlayerInjured;
    private getDayKey;
    private buildDefaultWeekPlan;
    private normalizeTrainingFocusEnum;
    private normalizeTrainingIntensityEnum;
    private fromStoredFocus;
    private fromStoredIntensity;
    private applyFormTrendAndSyncPlayers;
    private aggregateTeamStats;
    private createInitialInboxMessages;
    private createInboxMessage;
    private generateDailyInbox;
    private generateScheduleForSave;
    private loadRealScheduleForSeason;
    private buildInitialPlayerState;
    private buildInitialTeamState;
    private toSimPlayer;
    private getOrCreateTeamState;
    private updateTeamStateAfterGame;
    private estimateTeamStrength;
    private computeTeamFormAfterGame;
    private applyDailyTeamFormDecay;
    private pushLast5;
    private nextStreak;
    private computePlayerPerformanceScore;
    private applyOverallDrift;
    private deriveInitialPerfBonus;
    private deterministicNoise;
    private getAgeFromBirthDate;
    private clamp;
    private buildInitialRotation;
}
export {};
//# sourceMappingURL=saves.service.d.ts.map