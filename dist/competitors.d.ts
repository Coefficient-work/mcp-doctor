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
export type PublicCompetitor = {
    id: string;
    name: string;
    url: string;
    overlap: string;
};
export declare function loadRegistry(): CompetitorRegistry;
export declare function publicRegistry(registry: CompetitorRegistry): {
    updated: string;
    categories: Record<string, {
        label: string;
        competitors: PublicCompetitor[];
    }>;
};
export declare function formatCompetitorReport(registry: CompetitorRegistry, categoryFilter?: string): string;
