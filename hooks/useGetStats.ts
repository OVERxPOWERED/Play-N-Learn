import { label } from "motion/react-client";


export default function useGetStats(userCategory: string) {

    let commons = [
        { label: 'Endurance', value: 50 },
        { label: 'Focus', value: 50 }
    ]

    let studentStats = [
        ...commons,
        { label: "Intellect", value: 50, },
        { label: "Retention", value: 50, },
        { label: "Execution", value: 50 }
    ]
    let DevStats = [
        ...commons,
        { label: 'Logic', value: 50 },
        { label: 'Precision', value: 50 },
        { label: 'Velocity', value: 50 }
    ]

    let FreeLancerStats = [
        ...commons,
        { label: 'Inspiration', value: 50 },
        { label: 'Craftsmanship', value: 50 },
        { label: 'Hustle', value: 50 }
    ]

    let FounderStats = { ...commons, Vision: 50, Charisma: 50, Execution: 50 }

    if (userCategory === 'Student') return studentStats
    if (userCategory === 'Developer') return DevStats
    if (userCategory === 'FreeLancer') return FreeLancerStats
    if (userCategory === 'Founder') return FounderStats
    return commons
}