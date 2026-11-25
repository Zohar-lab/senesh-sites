import computersWebImg from '../assets/images/site_computers_web_1795619750449.jpg';
import creativeStoriesImg from '../assets/images/site_creative_stories_1795618554319.jpg';
import hobbyGamesImg from '../assets/images/site_hobby_games_1795619752054.jpg';
import marineNatureImg from '../assets/images/site_marine_nature_1795618554234.jpg';
import spaceAstronomyImg from '../assets/images/site_space_astronomy_1795618554685.jpg';
import studentCouncilImg from '../assets/images/site_student_council_1795619750970.jpg';
import { SiteFeedback, StudentSiteItem } from '../types/portal';

export const DEMO_SITES: StudentSiteItem[] = [
  {
    id: 'demo-student-council',
    title: 'אתר מועצת התלמידים · חנה סנש',
    creators: ['ליהי (קפטן המועצה)', 'אדם', 'מאיה'],
    creatorNote:
      'ברוכים הבאים לאתר הרשמי שבנינו עבור מועצת התלמידים! כאן אנחנו מרכזים יוזמות חברתיות, לוח אירועים, הפסקות פעילות ותיבת הצעות שיתופית לכל השכבות.',
    grade: "ה'-ו'",
    category: 'מועצת תלמידים',
    tags: ['מועצת תלמידים', 'חברה', 'מידע'],
    isFeatured: true,
    description:
      'כל יוזמות המועצה, פעילויות חברתיות בהפסקות, סקרי תלמידים ועדכונים שבועיים לכל בית הספר.',
    siteUrl: 'https://sites.google.com/view/hana-senesh-council-demo',
    imageUrl: studentCouncilImg,
    status: 'מאושר',
    createdAt: '2026-11-24T12:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-computers-web',
    title: 'קוד בטוח · מחשבים וגלישה חכמה',
    creators: ['אורי (צופן)', 'עדי'],
    creatorNote:
      'הכנו ב-Google Sites מדריך אינטראקטיבי לילדי בית הספר: איך בונים אתרים, איך שומרים על סיסמה חזקה ואיך בודקים מידע אמין ברשת.',
    grade: "ה'-ו'",
    category: 'מחשבים ורשת',
    tags: ['מחשבים ורשת', 'מידע', 'חקר'],
    isFeatured: true,
    description:
      'מדריכים מצולמים לבניית אתרים ב-Google Sites, כללי גלישה בטוחה וכלים דיגיטליים לשיעורי המחשבים.',
    siteUrl: 'https://sites.google.com/view/hana-senesh-cyber-demo',
    imageUrl: computersWebImg,
    status: 'מאושר',
    createdAt: '2026-11-23T11:30:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-hobby-games',
    title: 'פינת האתגרים, השחמט והתחביבים',
    creators: ['יונתן (מלך השחמט)', 'שירה'],
    creatorNote:
      'אנחנו חולים על חידות היגיון, שחמט, קוביות הונגריות ומשחקי קופסה! בנינו אתר שבו כל ילד יכול לקרוא חוקים, להכיר תחביבים חדשים ולהשתתף באתגר השבועי.',
    grade: "ג'-ד'",
    category: 'משחק תחביב',
    tags: ['משחק תחביב', 'חברה'],
    isFeatured: true,
    description:
      'המלצות למשחקי חשיבה, אסטרטגיות שחמט למתחילים, קוביית רוביק ותחביבים שמפגישים חברים בהפסקה.',
    siteUrl: 'https://sites.google.com/view/hana-senesh-hobby-demo',
    imageUrl: hobbyGamesImg,
    status: 'מאושר',
    createdAt: '2026-11-22T10:15:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-marine-nature',
    title: 'שומרי הים התיכון · חוף חיפה',
    creators: ['נועה (שומרת הים)', 'דניאל'],
    creatorNote:
      'היי לכולם! יצרנו את אתר ה-Google Sites שלנו על שונית החוף וצבי הים של הים התיכון. אספנו תמונות, מפה אינטראקטיבית של חופים מוגנים וחידון קצר שבנינו בתוך האתר!',
    grade: "ה'-ו'",
    category: 'חקר',
    tags: ['חקר', 'מידע'],
    isFeatured: true,
    description:
      'אתר חקר צבעוני על בעלי החיים בים התיכון, צמחיית החוף וטיפים לשמירה על ניקיון הים.',
    siteUrl: 'https://sites.google.com/edu-haifa.org.il/demo-marine-haifa',
    imageUrl: marineNatureImg,
    status: 'מאושר',
    createdAt: '2026-11-21T09:45:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-space-astronomy',
    title: 'מבט אל מערכת השמש',
    creators: ['יובל', 'תמר (כוכבת)', 'רוני'],
    creatorNote:
      'אנחנו צוות של שלושה מכיתה ד׳! לכל אחד מאיתנו יש עמוד משלו באתר על כוכב לכת אחר, כולל סרטונים שהטמענו וסיכומים שכתבנו בשיעור מחשבים.',
    grade: "ג'-ד'",
    category: 'חקר',
    tags: ['חקר', 'מידע', 'מחשבים ורשת'],
    isFeatured: true,
    description:
      'סיור דיגיטלי בין כוכבי הלכת, השמש, הירחים והטלסקופים הגדולים בחלל עם עובדות מפתיעות.',
    siteUrl: 'https://sites.google.com/view/hana-senesh-space-demo',
    imageUrl: spaceAstronomyImg,
    status: 'מאושר',
    createdAt: '2026-11-20T14:20:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-creative-stories',
    title: 'העיתון והמגזין החברתי של חנה סנש',
    creators: ['איתי (אוריגמי)', 'גלי'],
    creatorNote:
      'שלום חברים! פתחנו ב-Google Sites מגזין דיגיטלי שבו אנחנו מפרסמים סיפורים קצרים, מדריכי אוריגמי, ראיונות וסיכומים מאירועי השכבה.',
    grade: "א'-ב'",
    category: 'חברה',
    tags: ['חברה', 'מידע', 'משחק תחביב'],
    isFeatured: true,
    description:
      'מגזין כיתתי צבעוני עם סיפורים מאוירים, קיפולי אוריגמי, ראיונות והווי חברתי בבית הספר.',
    siteUrl: 'https://sites.google.com/view/hana-senesh-creative-demo',
    imageUrl: creativeStoriesImg,
    status: 'מאושר',
    createdAt: '2026-11-19T08:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-haifa-history',
    title: 'הסיפור של שכונת בת גלים והכרמל',
    creators: ['נעם', 'רומי'],
    creatorNote:
      'בעבודת השורשים והמקום שלנו ראיינו סבים וסבתות ובנינו ציר זמן של חיפה עם תמונות היסטוריות והסברים קצרים.',
    grade: "ג'-ד'",
    category: 'מידע',
    tags: ['מידע', 'חקר', 'חברה'],
    isFeatured: false,
    description:
      'ציר זמן אינטראקטיבי, סיפורי רחובות ומדריך מידע למשפחות על אתרי הטבע והמורשת של חיפה.',
    siteUrl: 'https://sites.google.com/view/hana-senesh-haifa-info-demo',
    imageUrl: '',
    status: 'מאושר',
    createdAt: '2026-11-18T16:10:00.000Z',
    isDemo: true,
  },
  {
    id: 'demo-coding-club',
    title: 'מועדון התכנות והרובוטיקה הצעיר',
    creators: ['תום (רובו-בוי)', 'אלון'],
    creatorNote:
      'באתר שלנו תוכלו לראות איך חיברנו חיישנים למיקרוביט ואיך מתכננים משחקים חכמים ברשת.',
    grade: "א'-ב'",
    category: 'מחשבים ורשת',
    tags: ['מחשבים ורשת', 'משחק תחביב'],
    isFeatured: false,
    description:
      'פרויקטים ראשונים בתכנות בלוקים, חוברת הדרכה לחברי המועדון וסרטוני הדגמה קצרים.',
    siteUrl: 'https://sites.google.com/view/hana-senesh-robotics-demo',
    imageUrl: '',
    status: 'מאושר',
    createdAt: '2026-11-17T13:05:00.000Z',
    isDemo: true,
  },
];

export const INITIAL_DEMO_FEEDBACK: Record<string, SiteFeedback[]> = {
  'demo-student-council': [
    {
      id: 'fb-demo-council-1',
      siteId: 'demo-student-council',
      playerName: 'הילה',
      playerGrade: 'שכבה ו׳',
      rating: 5,
      comment: 'סוף סוף יש מקום מסודר לראות מתי ההפסקה הפעילה! יוזמה מעולה.',
      createdAt: '2026-11-24T15:00:00.000Z',
    },
  ],
  'demo-marine-nature': [
    {
      id: 'fb-demo-1',
      siteId: 'demo-marine-nature',
      playerName: 'עומר (גיימר)',
      playerGrade: 'שכבה ה׳',
      rating: 5,
      comment: 'אתר מושקע ברמות! ממש אהבתי את הדף על צבי הים ואת החידון בסוף.',
      createdAt: '2026-11-15T10:30:00.000Z',
    },
  ],
  'demo-space-astronomy': [
    {
      id: 'fb-demo-2',
      siteId: 'demo-space-astronomy',
      playerName: 'מאיה',
      playerGrade: 'שכבה ג׳',
      rating: 5,
      comment: 'העיצוב של העמוד על שבתאי מהמם וקל מאוד לנווט בתפריט של האתר!',
      createdAt: '2026-11-16T12:15:00.000Z',
    },
  ],
};
