import React, { useEffect, useState } from "react";
import { useTable, useSortBy } from "react-table";

import { SevedFileResponse, savedfileApi } from "../../api";

type Props = {
    tableColumns: any;
    bot: SevedFileResponse[];
};

const Table: React.FC<Props> = ({ tableColumns, bot }) => {
    const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({ columns:tableColumns, data: bot }, useSortBy);
    return (
        <table {...getTableProps()}>
            <thead>
                {headerGroups.map((headerGroup) => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map((column) => (
                    <th {...column.getHeaderProps(column.getSortByToggleProps())}>{column.render("Header")}
                    {column.canSort &&
                        (() => {
                        return (
                            <div>
                            {column.isSorted
                                ? column.isSortedDesc
                                ? "🔽"
                                : "🔼"
                                : ""}
                            </div>
                        );
                        })()}
                    </th>
                    ))}
                </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {rows.map((row) => {
                prepareRow(row);
                return (
                    <tr {...row.getRowProps()}>
                    {row.cells.map((cell) => (
                        <td {...cell.getCellProps()}>
                        {cell.render("Cell")}
                        </td>
                    ))}
                    </tr>
                );
                })}
            </tbody>
        </table>
    );
};

export default Table;