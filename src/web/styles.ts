import { css } from "lit";

export const sharedStyles = css`
  :host {
    display: block;
    color: var(--text, #e7edf5);
    --sans: Roboto, sans-serif;
    font-family: Roboto, sans-serif;
  }

  h1 {
    font-size: 32px;
    margin: 0;
    letter-spacing: -0.02em;
  }

  h2 {
    font-size: 18px;
    margin: 0;
  }

  sl-button::part(base) {
    border-radius: 10px;
    font-weight: 600;
  }
`;
