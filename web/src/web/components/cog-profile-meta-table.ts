import { LitElement, css, html, nothing } from "lit";

type MetaTableRow = {
  label: string;
  values: string[];
  valueTestId?: string;
};

export class CogProfileMetaTable extends LitElement {
  static properties = {
    count: { type: Number },
    rows: { attribute: false },
    tableTestId: { attribute: "table-test-id" },
  };

  static styles = css`
    .profile-meta {
      overflow-x: auto;
      max-width: 100%;
    }

    .profile-meta-table {
      width: auto;
      border-collapse: collapse;
      font-size: 11px;
      min-width: 0;
    }

    .profile-meta-table td {
      border-top: 1px solid #233143;
      padding: 4px 6px;
      text-align: center;
      white-space: nowrap;
    }

    .profile-meta-table tr:first-child td {
      border-top: 0;
    }

    .profile-meta-table td:first-child {
      text-align: left;
      font-weight: 600;
      color: var(--muted, #98a6b5);
      position: sticky;
      left: 0;
      background: inherit;
    }
  `;

  declare count: number;
  declare rows: MetaTableRow[];
  declare tableTestId: string;

  constructor() {
    super();
    this.count = 0;
    this.rows = [];
    this.tableTestId = "";
  }

  render() {
    return html`
      <div class="profile-meta">
        <table
          class="profile-meta-table"
          data-test-id=${this.tableTestId || nothing}
        >
          <tbody>
            ${this.rows.map(
              (row, index) => html`
                <tr>
                  <td>${index === 0 ? `Cogs: ${this.count}` : row.label}</td>
                  ${row.values.map(
                    (value) => html`
                      <td data-test-id=${row.valueTestId || nothing}>
                        ${value}
                      </td>
                    `,
                  )}
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}

if (!customElements.get("cog-profile-meta-table")) {
  customElements.define("cog-profile-meta-table", CogProfileMetaTable);
}

export {};
