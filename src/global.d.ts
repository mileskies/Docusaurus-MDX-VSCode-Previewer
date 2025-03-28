declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface ElementClass {
    render(): any;
  }
}
