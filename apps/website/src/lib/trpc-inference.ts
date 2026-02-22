type Procedure = (...args: any[]) => unknown;

export type InferProcedureInput<TProcedure extends Procedure> = Parameters<TProcedure>[0];

export type InferProcedureOutput<TProcedure extends Procedure> = Awaited<ReturnType<TProcedure>>;
