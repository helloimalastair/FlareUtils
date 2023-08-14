interface DrandResponse {
	round: number;
	randomness: string;
	signature: string;
	previous_signature: string;
}

/**
 * Supported seed types for Isaac.
 */
type IsaacSeed = string | number | number[];

export type { DrandResponse, IsaacSeed };
