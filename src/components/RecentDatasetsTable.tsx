import type { RecentDataset } from "../types";
import { formatDateTime, truncate } from "../lib/format";

interface RecentDatasetsTableProps {
  rows: RecentDataset[];
}

export function RecentDatasetsTable({ rows }: RecentDatasetsTableProps) {
  return (
    <div className="table-wrap">
      <table className="dataset-table">
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Publisher</th>
            <th>Modified</th>
            <th>Created</th>
            <th>Resources</th>
            <th>Formats</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((dataset) => (
            <tr key={dataset.id}>
              <td title={dataset.title}>
                <a
                  className="dataset-link"
                  href={`https://catalog.data.gov/dataset/${dataset.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {truncate(dataset.title, 74)}
                </a>
              </td>
              <td title={dataset.organization}>{truncate(dataset.organization, 42)}</td>
              <td>{formatDateTime(dataset.metadataModified)}</td>
              <td>{formatDateTime(dataset.metadataCreated)}</td>
              <td>{dataset.resourceCount}</td>
              <td>
                <div className="format-pills">
                  {dataset.formats.length === 0 ? (
                    <span className="format-pill format-pill--muted">N/A</span>
                  ) : (
                    dataset.formats.map((format) => (
                      <span key={`${dataset.id}-${format}`} className="format-pill">
                        {format}
                      </span>
                    ))
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
