import { CreateSaveDto } from "./saves.dto";
type SavePayload = {
    season?: string;
    week?: number;
    status?: string;
    currentDate?: string;
    inboxUnread?: number;
    inboxState?: {
        responses?: Record<string, {
            responseId: string;
            respondedAt: string;
            playerId?: number;
            moraleDelta?: number;
        }>;
    };
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
            intensityPercent?: number;
            focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
            durationMinutes?: number;
        }>>;
        playerPlans?: Record<string, {
            intensity?: "low" | "balanced" | "high";
            intensityPercent?: number;
            focus?: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
            targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
            dayPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                intensity: "low" | "balanced" | "high" | number;
                intensityPercent?: number;
                focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                durationMinutes?: number;
            }>>;
        }>;
    };
    trainingPlan?: {
        intensity: "low" | "balanced" | "high";
        intensityPercent?: number;
        focus: "shooting" | "defense" | "fitness" | "balanced";
    };
    tactics?: {
        pace: "slow" | "balanced" | "fast";
        threePtFocus: number;
        defenseScheme: "drop" | "switch" | "press";
        offenseStyle?: "balanced" | "pick_and_roll" | "post_up" | "transition" | "iso";
        defenseMode?: "man" | "zone" | "hybrid";
        instructions?: {
            fastBreak?: boolean;
            pressAfterMade?: boolean;
            isoStars?: boolean;
            crashBoards?: boolean;
        };
        boards?: {
            attack?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                playerId: number | null;
                x: number;
                y: number;
            }>>;
            transition?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                playerId: number | null;
                x: number;
                y: number;
            }>>;
            defense?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                playerId: number | null;
                x: number;
                y: number;
            }>>;
        };
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
        trainingCarry?: {
            offense?: number;
            defense?: number;
            physical?: number;
            iq?: number;
            stamina?: number;
            health?: number;
            morale?: number;
        };
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
    transferState?: {
        playerTeamOverrides?: Record<string, number>;
        transactions?: Array<{
            offerId: number;
            day: number;
            date: string;
            fromTeamId: number;
            toTeamId: number;
            outgoingPlayerIds: number[];
            incomingPlayerIds: number[];
            status: "COMPLETED";
        }>;
    };
    rosterManagement?: {
        tradeBlockPlayerIds?: number[];
        developmentLeaguePlayerIds?: number[];
        comparePlayerIds?: number[];
        playerRoles?: Record<string, string>;
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
    l10: string;
};
export declare class SavesService {
    private tradesService;
    createSave(dto: CreateSaveDto): Promise<{
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        teamId: number | null;
        createdAt: Date;
        updatedAt: Date;
        season: string;
        description: string | null;
        coachProfileId: number | null;
        currentDate: Date;
        managedTeamId: number | null;
        coachName: string | null;
        coachAvatarId: string | null;
        userId: number | null;
        version: number;
    }>;
    getSaveById(id: number): Promise<{
        team: {
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            form: number;
            morale: number;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
        } | null;
        coachProfile: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            userId: number | null;
            displayName: string;
            avatarId: string;
            reputation: number;
            preferredStyle: string | null;
        } | null;
    } & {
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        teamId: number | null;
        createdAt: Date;
        updatedAt: Date;
        season: string;
        description: string | null;
        coachProfileId: number | null;
        currentDate: Date;
        managedTeamId: number | null;
        coachName: string | null;
        coachAvatarId: string | null;
        userId: number | null;
        version: number;
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
        teamId: number | null;
        createdAt: Date;
        updatedAt: Date;
        season: string;
        description: string | null;
        coachProfileId: number | null;
        currentDate: Date;
        managedTeamId: number | null;
        coachName: string | null;
        coachAvatarId: string | null;
        userId: number | null;
        version: number;
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
            createdAt: Date;
            updatedAt: Date;
            form: number;
            morale: number;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
        } | null;
        coachProfile: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            userId: number | null;
            displayName: string;
            avatarId: string;
            reputation: number;
            preferredStyle: string | null;
        } | null;
        inboxCount: number;
        nextMatch: import("../fixtures/fixtureModel").FixtureModel | null;
        lastResult: import("../fixtures/fixtureModel").FixtureModel | null;
        data: {
            inboxUnread: number;
            season?: string;
            week?: number;
            status?: string;
            currentDate?: string;
            inboxState?: {
                responses?: Record<string, {
                    responseId: string;
                    respondedAt: string;
                    playerId?: number;
                    moraleDelta?: number;
                }>;
            };
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
                    intensityPercent?: number;
                    focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                    durationMinutes?: number;
                }>>;
                playerPlans?: Record<string, {
                    intensity?: "low" | "balanced" | "high";
                    intensityPercent?: number;
                    focus?: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                    targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
                    dayPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                        intensity: "low" | "balanced" | "high" | number;
                        intensityPercent?: number;
                        focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                        durationMinutes?: number;
                    }>>;
                }>;
            };
            trainingPlan?: {
                intensity: "low" | "balanced" | "high";
                intensityPercent?: number;
                focus: "shooting" | "defense" | "fitness" | "balanced";
            };
            tactics?: {
                pace: "slow" | "balanced" | "fast";
                threePtFocus: number;
                defenseScheme: "drop" | "switch" | "press";
                offenseStyle?: "balanced" | "pick_and_roll" | "post_up" | "transition" | "iso";
                defenseMode?: "man" | "zone" | "hybrid";
                instructions?: {
                    fastBreak?: boolean;
                    pressAfterMade?: boolean;
                    isoStars?: boolean;
                    crashBoards?: boolean;
                };
                boards?: {
                    attack?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                        playerId: number | null;
                        x: number;
                        y: number;
                    }>>;
                    transition?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                        playerId: number | null;
                        x: number;
                        y: number;
                    }>>;
                    defense?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                        playerId: number | null;
                        x: number;
                        y: number;
                    }>>;
                };
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
                trainingCarry?: {
                    offense?: number;
                    defense?: number;
                    physical?: number;
                    iq?: number;
                    stamina?: number;
                    health?: number;
                    morale?: number;
                };
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
            transferState?: {
                playerTeamOverrides?: Record<string, number>;
                transactions?: Array<{
                    offerId: number;
                    day: number;
                    date: string;
                    fromTeamId: number;
                    toTeamId: number;
                    outgoingPlayerIds: number[];
                    incomingPlayerIds: number[];
                    status: "COMPLETED";
                }>;
            };
            rosterManagement?: {
                tradeBlockPlayerIds?: number[];
                developmentLeaguePlayerIds?: number[];
                comparePlayerIds?: number[];
                playerRoles?: Record<string, string>;
            };
        };
        createdAt: Date;
        updatedAt: Date;
    }>;
    advanceSave(id: number): Promise<{
        team: {
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            form: number;
            morale: number;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
        } | null;
        coachProfile: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            userId: number | null;
            displayName: string;
            avatarId: string;
            reputation: number;
            preferredStyle: string | null;
        } | null;
    } & {
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        teamId: number | null;
        createdAt: Date;
        updatedAt: Date;
        season: string;
        description: string | null;
        coachProfileId: number | null;
        currentDate: Date;
        managedTeamId: number | null;
        coachName: string | null;
        coachAvatarId: string | null;
        userId: number | null;
        version: number;
    }>;
    private getSeasonDay;
    private applyWeeklyFreeAgentOverallDecay;
    advanceSaveToDate(id: number, targetDate: string, includeTargetDay?: boolean): Promise<{
        team: {
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            form: number;
            morale: number;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
        } | null;
        coachProfile: {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            userId: number | null;
            displayName: string;
            avatarId: string;
            reputation: number;
            preferredStyle: string | null;
        } | null;
    } & {
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        teamId: number | null;
        createdAt: Date;
        updatedAt: Date;
        season: string;
        description: string | null;
        coachProfileId: number | null;
        currentDate: Date;
        managedTeamId: number | null;
        coachName: string | null;
        coachAvatarId: string | null;
        userId: number | null;
        version: number;
    }>;
    deleteSave(id: number): Promise<{
        data: import("@prisma/client/runtime/library").JsonValue;
        id: number;
        name: string;
        teamId: number | null;
        createdAt: Date;
        updatedAt: Date;
        season: string;
        description: string | null;
        coachProfileId: number | null;
        currentDate: Date;
        managedTeamId: number | null;
        coachName: string | null;
        coachAvatarId: string | null;
        userId: number | null;
        version: number;
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
            preview: string;
            needsResponse: boolean;
            responded: boolean;
            responseId: string | null;
            choices: {
                id: string;
                label: string;
                moraleDelta?: number;
            }[];
        }[];
    }>;
    getSchedule(id: number, from?: string, to?: string): Promise<import("../fixtures/fixtureModel").FixtureModel[]>;
    getResults(id: number): Promise<import("../fixtures/fixtureModel").FixtureModel[]>;
    getResultDetails(id: number, gameId: number): Promise<{
        id: number;
        gameDate: Date;
        homeTeam: {
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            form: number;
            morale: number;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
        };
        awayTeam: {
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            form: number;
            morale: number;
            shortName: string;
            nbaTeamId: number | null;
            city: string;
            conference: string | null;
            division: string | null;
            primaryColor: string | null;
            secondaryColor: string | null;
            logoKey: string | null;
            logoPath: string | null;
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
            performanceRating: number;
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
                steals: number;
                blocks: number;
                turnovers: number;
                twoPtMade: number;
                twoPtAtt: number;
                threePtMade: number;
                threePtAtt: number;
                ftMade: number;
                ftAtt: number;
            };
            away: {
                points: number;
                rebounds: number;
                assists: number;
                steals: number;
                blocks: number;
                turnovers: number;
                twoPtMade: number;
                twoPtAtt: number;
                threePtMade: number;
                threePtAtt: number;
                ftMade: number;
                ftAtt: number;
            };
        };
        players: {
            playerId: number;
            name: string;
            teamShortName: string;
            minutes: number;
            points: number;
            twoPtMade: number;
            twoPtAtt: number;
            threePtMade: number;
            threePtAtt: number;
            ftMade: number;
            ftAtt: number;
            dunks: number;
            oreb: number;
            dreb: number;
            rebounds: number;
            assists: number;
            steals: number;
            blocks: number;
            turnovers: number;
            fouls: number;
            plusMinus: number;
            performanceRating: number;
        }[];
    }>;
    private normalizeGameStatPointsForDisplay;
    getStandings(id: number): Promise<{
        east: StandingsRow[];
        west: StandingsRow[];
    }>;
    private getInboxInteraction;
    markInboxMessageRead(saveId: number, msgId: number): Promise<{
        success: boolean;
        unread: number;
        messageId: number;
    }>;
    respondInboxMessage(saveId: number, msgId: number, responseId: string): Promise<{
        success: boolean;
        alreadyResponded: boolean;
        unread?: undefined;
        messageId?: undefined;
        responseId?: undefined;
        moraleDelta?: undefined;
        playerId?: undefined;
    } | {
        success: boolean;
        unread: number;
        messageId: number;
        responseId: string;
        moraleDelta: number;
        playerId: number | null;
        alreadyResponded?: undefined;
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
    saveTactics(saveId: number, tactics: Partial<NonNullable<SavePayload["tactics"]>>, rotation?: SavePayload["rotation"]): Promise<{
        success: boolean;
        tactics: {
            pace: "slow" | "balanced" | "fast";
            threePtFocus: number;
            defenseScheme: "drop" | "switch" | "press";
            offenseStyle?: "balanced" | "pick_and_roll" | "post_up" | "transition" | "iso";
            defenseMode?: "man" | "zone" | "hybrid";
            instructions?: {
                fastBreak?: boolean;
                pressAfterMade?: boolean;
                isoStars?: boolean;
                crashBoards?: boolean;
            };
            boards?: {
                attack?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                    playerId: number | null;
                    x: number;
                    y: number;
                }>>;
                transition?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                    playerId: number | null;
                    x: number;
                    y: number;
                }>>;
                defense?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                    playerId: number | null;
                    x: number;
                    y: number;
                }>>;
            };
            board?: Partial<Record<"PG" | "SG" | "SF" | "PF" | "C", {
                playerId: number | null;
                x: number;
                y: number;
            }>>;
        };
        rotation: {
            PG?: number | null;
            SG?: number | null;
            SF?: number | null;
            PF?: number | null;
            C?: number | null;
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
            intensityPercent?: number;
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
                intensityPercent?: number;
                focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                durationMinutes?: number;
            }>>;
            playerPlans?: Record<string, {
                intensity?: "low" | "balanced" | "high";
                intensityPercent?: number;
                focus?: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
                dayPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                    intensity: "low" | "balanced" | "high" | number;
                    intensityPercent?: number;
                    focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                    durationMinutes?: number;
                }>>;
            }>;
        };
    }>;
    finalizeMatchSimulation(saveId: number, gameId: number, payload: {
        homeScore?: number;
        awayScore?: number;
        homePlayers?: unknown;
        awayPlayers?: unknown;
    }): Promise<{
        success: boolean;
        game: import("../fixtures/fixtureModel").FixtureModel;
    }>;
    saveRosterManagement(saveId: number, payload: {
        tradeBlockPlayerIds?: number[];
        developmentLeaguePlayerIds?: number[];
        comparePlayerIds?: number[];
        playerRoles?: Record<string, string>;
    }): Promise<{
        success: boolean;
        rosterManagement: {
            tradeBlockPlayerIds?: number[];
            developmentLeaguePlayerIds?: number[];
            comparePlayerIds?: number[];
            playerRoles?: Record<string, string>;
        };
    }>;
    getTrainingConfig(saveId: number): Promise<{
        success: boolean;
        trainingPlan: {
            intensity: "low" | "balanced" | "high";
            intensityPercent?: number;
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
            weekPlan: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                intensity: "low" | "balanced" | "high";
                intensityPercent?: number;
                focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                durationMinutes?: number;
            }>>;
            playerPlans: Record<string, {
                intensity?: "low" | "balanced" | "high";
                intensityPercent?: number;
                focus?: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
                dayPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                    intensity: "low" | "balanced" | "high" | number;
                    intensityPercent?: number;
                    focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                    durationMinutes?: number;
                }>>;
            }>;
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
        dayPlan: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray | null;
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
        dayPlan?: unknown;
    }): Promise<{
        success: boolean;
        plan: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            playerId: number;
            saveId: number;
            intensity: string;
            focus: string;
            dayPlan: import("@prisma/client/runtime/library").JsonValue | null;
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
        nextMatch: import("../fixtures/fixtureModel").FixtureModel | null;
        recentResults: import("../fixtures/fixtureModel").FixtureModel[];
        upcomingFixtures: import("../fixtures/fixtureModel").FixtureModel[];
        standings: StandingsRow[];
        leaders: {
            name: string;
            value: number;
            metric: string;
            totalPoints: number;
            games: number;
        }[];
        topScorers: {
            name: string;
            value: number;
            metric: string;
            totalPoints: number;
            games: number;
        }[];
        recentPerformance: {
            label: string;
            points: number;
        }[];
        overview: {
            leaguePosition: number | null;
            conference: string;
            winRate: number;
            wins: number;
            losses: number;
            teamValue: number;
            currentWeek: number;
            weekRange: {
                start: string;
                end: string;
            };
            simulatedGamesInWeek: number;
            totalGamesInWeek: number;
        };
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
                intensityPercent?: number;
                focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                durationMinutes?: number;
            }>>;
            playerPlans?: Record<string, {
                intensity?: "low" | "balanced" | "high";
                intensityPercent?: number;
                focus?: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                targetAttribute?: "shooting3" | "shootingMid" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "iq";
                dayPlan?: Partial<Record<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun", {
                    intensity: "low" | "balanced" | "high" | number;
                    intensityPercent?: number;
                    focus: "shooting" | "defense" | "fitness" | "balanced" | "playmaking";
                    durationMinutes?: number;
                }>>;
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
    private computeLastNRecord;
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
    private buildInitialPlayerState;
    private buildInitialTeamState;
    private toSimPlayer;
    private getEffectiveGameRosterForTeam;
    private getOrCreateTeamState;
    private updateTeamStateAfterGame;
    private estimateTeamStrength;
    private computeTeamFormAfterGame;
    private applyDailyTeamFormDecay;
    private pushLast5;
    private nextStreak;
    private computePlayerPerformanceScore;
    private applyGameweekPerformanceAdjustments;
    private applyOverallDrift;
    private deriveInitialPerfBonus;
    private deterministicNoise;
    private getAgeFromBirthDate;
    private clamp;
    private buildInitialRotation;
}
export {};
//# sourceMappingURL=saves.service.d.ts.map