export type SiteTag =
  | 'משחק תחביב'
  | 'חקר'
  | 'מידע'
  | 'חברה'
  | 'מועצת תלמידים'
  | 'מחשבים ורשת';

export type TagFilter = 'הכל' | SiteTag;

export type SiteSortMode = 'tag-order' | 'newest' | 'featured' | 'title-az';

export type PortalPage = 'home' | 'sites' | 'generator';

export type GradeFilter = 'כל השכבות' | "א'-ב'" | "ג'-ד'" | "ה'-ו'";

export type SiteStatus = 'מאושר' | 'ממתין' | 'נדחה';

export interface StudentSiteItem {
  id: string;
  rowNumber?: number;
  title: string;
  creators: string[];
  creatorNote: string;
  grade: string;
  category: string;
  tags: SiteTag[];
  isFeatured: boolean;
  description: string;
  siteUrl: string;
  imageUrl: string;
  status: string;
  createdAt?: string;
  isDemo?: boolean;
}

export interface GoogleSiteLinkInfo {
  isValid: boolean;
  isGoogleSites: boolean;
  isEditLink: boolean;
  isOrgScopedUrl: boolean;
  normalizedUrl: string;
  domainLabel: string;
  errorMessage?: string;
  warningMessage?: string;
}

export type ModerationCategory = 'offensive' | 'violence' | 'sexual';

export interface ModerationResult {
  isAllowed: boolean;
  flaggedCategories: ModerationCategory[];
  reasonMessage: string;
}

export interface SiteFeedback {
  id: string;
  siteId: string;
  playerName: string;
  playerGrade?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type EditorRole = 'super_admin' | 'editor';

export interface AuthorizedEditor {
  email: string;
  role: EditorRole;
  addedBy: string;
  addedAt: string;
}

export type GameSimulatorTab = 'menu' | 'tutorial' | 'pause';

export interface GamePromptWizardState {
  currentStep: number;
  simulatorTab: GameSimulatorTab;
  gameName: string;
  gameSummary: string;
  isRealWorldBased: 'yes' | 'no';
  realWorldGame: string;
  digitalTwist: string;
  dimension: '2D' | '3D';
  cameraView: 'מבט מלמעלה' | 'מבט מהצד' | 'דרך עיני השחקן';
  winCondition: string;
  conflictObstacle: string;
  loseCondition: string;
  easyLevel: string;
  mediumLevel: string;
  hardLevel: string;
  artStyle: 'מצויר וצבעוני' | 'פיקסל-ארט (רטרו)' | 'חלל וניאון זוהר' | 'עולם הטבע';
  characterAndBg: string;
  controls: string;
  tutorialText: string;
}

export type PromptProductionStatus = 'ממתין' | 'הופק';

export interface SavedGamePromptItem {
  id: string;
  ownerUid?: string;
  ownerEmail?: string;
  promptName: string;
  gameName: string;
  creatorFirstName: string;
  className: string;
  promptText: string;
  productionStatus: PromptProductionStatus;
  createdSiteUrl: string;
  isManualEdited?: boolean;
  wizardState?: GamePromptWizardState;
  createdAt: string;
  updatedAt: string;
  storageScope?: 'cloud' | 'local';
}
