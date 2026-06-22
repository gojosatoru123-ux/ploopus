export const INDEXES_FILE = "note-indexes-nickblake.json";
export const FOLDERS_FILE = "folders-nickblake.json";
export const MANIFEST_FILE = "sync-manifest.json";
export const NOTES_DIR = "notes";
export const MEDIA_DIR = "media"
export const PLUGINS_DIR = "plugins";
export const PLUGINS_INDEXES_FILE = "plugin-indexes-nickblake.json";
export const PLUGINS_NOTIFICATIONS_FILE = "plugin-notifications-nickblake.json";
export const SLIDEDECK_FILE = "ploopus-flashcard-decks-nickblake.json"
export const CALENDAR_FILE = "ploopus-calendar-events-nickblake.json"

interface Plan {
    planName: string
    price: number
}

interface Plans {
    free: Plan,
    pro: Plan,
    creator: Plan
}

interface Tier {
    name: string,
    plan: Plan,
    period: string,
    description: string,
    features: string[],
    cta: string,
    highlighted: boolean,
    cardBg: string,
    btnBg: string,
    checkColor: string,
}

export const PLANS: Plans = {
    'free': {
        planName: 'free',
        price: 0
    },
    'pro': {
        planName: 'pro',
        price: 5
    },
    'creator': {
        planName: 'creator',
        price: 7
    }
}
export const TIERS: Tier[] = [
    {
        name: "Free",
        plan: PLANS.free,
        period: "forever",
        description: "Everything you need for personal knowledge management. Free forever.",
        features: [
            "Unlimited notes",
            "Unlimited folders",
            "Unlimited mind maps",
            "Unlimited flashcards",
            "38+ editing blocks",
            "Knowledge graph",
            "Knowledge feed",
            "Knowledge timeline",
            "Knowledge reminder engine",
            "PDF, HTML, MD & TXT exports",
            "3 plugins to supercharge your workflow",
            "Publish pages publicly with a shareable link using github pages or manual deploy",
        ],
        cta: "Start Free",
        highlighted: false,
        cardBg: "bg-[hsl(var(--green-light))] border-[hsl(var(--green-badge))]/15",
        btnBg: "bg-[hsl(var(--green-badge))] text-white",
        checkColor: "text-[hsl(var(--green-badge))]",
    },
    {
        name: "Pro",
        plan: PLANS.pro,
        period: "/month",
        description: "For people who want automatic backup, sync, and a seamless experience across devices.",
        features: [
            "Everything in Free",
            "Premium templates",
            "Semantic search",
            "AI features using your own AI keys or open-source models",
            "Advanced knowledge analytics",
            "Knowledge portfolio",
            "Custom dashboards",
            "Unlimited feed & timeline history",
            "Plugin builder",
            "Plugin export & import",
            "10 installed plugins",
        ],
        cta: "Start Today",
        highlighted: true,
        cardBg: "bg-gradient-to-br from-[hsl(var(--green-badge))] to-[hsl(var(--green-badge))]/80 border-[hsl(var(--green-badge))]",
        btnBg: "bg-[hsl(var(--yellow-light))] text-accent-foreground",
        checkColor: "text-[hsl(var(--yellow-tag))]",
    },
    {
        name: "Creator",
        plan: PLANS.creator,
        period: "/month",
        description: "Build complete workspace applications, workflows and systems tailored to your needs.",
        features: [
            "Everything in Pro",
            "Unlimited plugins with unlimited installs",
            "Unlimited plugin building",
            "Early access features",
        ],
        cta: "Start Today",
        highlighted: false,
        cardBg: "bg-[hsl(var(--yellow-light))] border-accent/20",
        btnBg: "bg-accent text-accent-foreground",
        checkColor: "text-accent-foreground",
    },
];
// export const PLANS = {
//     // THIS IS THE COUNTRY WISE PRICING PLAN FOR THE THREE PLANS SINCE THE PRICING VARIES BASED ON THE COUNTRY
//     'INDIA': {
//         'currency': 'INR',
//         'free': 0,
//         'pro': 10,
//         'creator':20
//     },
//     'EUROPE': {
//         'currency': 'EUR',
//         'free': 0,
//         'pro': 2,
//         'creator': 3
//     },
//     'OCEANIA': {
//         'currency': 'AUD',
//         'free': 0,
//         'pro': 2,
//         'creator': 3
//     },
//     'ASIA': {
//         'currency': 'USD',
//         'free': 0,
//         'pro': 1,
//         'creator': 2
//     },
//     'AFRICA': {
//         'currency': 'USD',
//         'free': 0,
//         'pro': 1,
//         'creator': 2
//     },
//     'OTHER': {
//         'currency': 'USD',
//         'free': 0,
//         'pro': 2,
//         'creator': 3
//     }
// }