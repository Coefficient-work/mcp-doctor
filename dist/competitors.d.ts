export type Competitor = {
    id: string;
    name: string;
    url: string;
    threat: string;
    overlap: string;
    ourAngle: string;
};
export type CompetitorRegistry = {
    updated: string;
    positioning: string;
    categories: Record<string, {
        label: string;
        competitors: Competitor[];
    }>;
};
export declare function loadRegistry(): CompetitorRegistry;
export declare function formatCompetitorReport(registry: CompetitorRegistry, categoryFilter?: string): string;
export declare function listCompetitorIds(registry: CompetitorRegistry): string[];
