export interface CreateSaveDto {
  name: string;
  description?: string;
  managerName?: string;
  username?: string;
  coachAvatar?: string;
  teamShortName?: string | null;
  season?: string;
  startDate?: string;
}

export interface SaveResponseDto {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  data: any;
}
