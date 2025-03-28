declare module '@babel/standalone' {
  export function transform(code: string, options: { presets?: string[]; filename?: string }): {
    code: string;
  };
}
