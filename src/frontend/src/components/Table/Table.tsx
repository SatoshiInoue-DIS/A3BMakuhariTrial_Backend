// import React, { useEffect, useState } from "react";
// import { useTable, useSortBy } from "react-table";

import { SevedFileResponse, savedfileApi, deleteApi } from "../../api";

import React, { forwardRef, useRef, useEffect } from 'react';
import { useTable, Column, useSortBy, useRowSelect } from 'react-table';
import { Data } from '../Data';

type Props = {
    tableColumns: any;
    files: SevedFileResponse[];
};


interface IIndeterminateInputProps {
    indeterminate?: boolean;
    name: string;
    // tableColumns: any;
    // files: SevedFileResponse[];
    
}
const useCombinedRefs = ( ...refs: Array<React.Ref<HTMLInputElement> | React.MutableRefObject<HTMLInputElement | null>> ): React.MutableRefObject<HTMLInputElement | null> => {
    const targetRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        refs.forEach(
            (ref: React.Ref<HTMLInputElement> | React.MutableRefObject<null>) => {
                if (!ref) return;
                // refが関数（つまりReact.Ref）の場合
                if (typeof ref === 'function') {
                    ref(targetRef.current);
                // refがReact.MutableRefObjectの場合
                } else {
                    (ref as React.MutableRefObject<HTMLInputElement | null>).current = targetRef.current;
                }
            }
        );
    }, [refs]);
    return targetRef;
};

const IndeterminateCheckbox = forwardRef<HTMLInputElement, IIndeterminateInputProps >(({ indeterminate, ...rest }, ref: React.Ref<HTMLInputElement>) => {
    const defaultRef = useRef(null);
    const combinedRef = useCombinedRefs(ref, defaultRef);
    useEffect(() => {
        if (combinedRef?.current) {
            combinedRef.current.indeterminate = indeterminate ?? false;
        }
    }, [combinedRef, indeterminate]);

    return (
        <>
            <input type="checkbox" ref={combinedRef} {...rest} />
        </>
    );
});

const Table = ({ columns, data, callback, bot }: { columns: Column<SevedFileResponse>[]; data: SevedFileResponse[]; callback: (selected: SevedFileResponse[]) => void; bot:string; }) => {
    const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow, selectedFlatRows, state: { selectedRowIds } } = useTable<SevedFileResponse>(
        { columns, data }, useSortBy, useRowSelect,
        (hooks) => {
            hooks.visibleColumns.push((columns) => [
                {
                    id: 'selection',
                    Header: ({ getToggleAllRowsSelectedProps }) => (
                        <div>
                            <IndeterminateCheckbox name={''} {...getToggleAllRowsSelectedProps()} />
                        </div>
                    ),
                    Cell: ({ row }: { row: any }) => (
                        <div>
                            <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
                        </div>
                    ),
                },
                ...columns,
                {
                    Header: "削除",
                    Cell: ({ row }) => {
                        const fileName = row.original.filename;
                        const fileArray = [{ filename: fileName }]
                        return (
                            <div>
                                <OneDelete filename={fileArray}/>
                            </div>
                        );
                    }
                }
            ]);
        }
    );
    
    const OneDelete = ({ filename }: { filename: { filename: string }[] }) => {
        return <button onClick={() => makeApiRequest(filename, bot)}>削除</button>
    }
    
    const makeApiRequest = async (filename: {filename: string}[], bot:string) => {
        try {
            const response = await deleteApi(filename, bot);
            
        } catch (e) {
            alert(`削除処理中にエラーが発生しました: ${e}`);
        } finally {
        }
    };
    
    useEffect(() => { callback(selectedFlatRows.map((d) => d.original)); }, [callback, selectedFlatRows]);
    
    return (
        <>
            <table {...getTableProps()}>
                <thead>
                    {headerGroups.map((headerGroup) => {
                        const { key, ...restHeaderGroupProps } = headerGroup.getHeaderGroupProps();
                        return (
                            <tr {...restHeaderGroupProps} key={key}>
                                {headerGroup.headers.map((column) => {
                                    const { key, ...restColumn } = column.getHeaderProps(
                                        column.getSortByToggleProps()
                                    );
                                    return (
                                        <th {...restColumn} key={key}>
                                            <>
                                                {column.render('Header')}
                                                <span>
                                                    {' '}{column.isSorted ? column.isSortedDesc ? ' 🔽' : ' 🔼' : ''}{' '}
                                                </span>
                                            </>
                                        </th>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </thead>
                <tbody {...getTableBodyProps()}>
                    {rows.map((row) => {
                        prepareRow(row);
                        const { key, ...restRowProps } = row.getRowProps();
                        return (
                            <tr {...restRowProps} key={key}>
                                {row.cells.map((cell) => {
                                    const { key, ...restCellProps } = cell.getCellProps();
                                    return (
                                        <td {...restCellProps} key={key}>
                                            {cell.render('Cell')}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>



            {/* <p>Selected Rows: {Object.keys(selectedRowIds).length}</p>
            <pre>
                <code>
                    {JSON.stringify(
                        {
                            selectedRowIds: selectedRowIds,
                            'selectedFlatRows[].original': selectedFlatRows.map(
                                (d) => d.original
                            ),
                        },
                        null,
                        2
                    )}
                </code>
            </pre> */}



        </>
    );
};















//     // const [checkedValues, setCheckedValues] = useState<string[]>([]);

//     // const checkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     //     if (checkedValues.includes(e.target.value)) {
//     //         setCheckedValues(
//     //             checkedValues.filter((checkedValue) => checkedValue !== e.target.value)
//     //         );
//     //     } else {
//     //         setCheckedValues([...checkedValues, e.target.value]);
//     //     }
//     // };
// const Table: React.FC<Props> = ({ tableColumns, files }) => {
//     const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({ columns:tableColumns, data: files }, useSortBy);

//     return (
//         <table {...getTableProps()}>
//             <thead>
//                 {headerGroups.map((headerGroup) => (
//                     <tr {...headerGroup.getHeaderGroupProps()}>
//                         {headerGroup.headers.map((column) => (
//                             <th {...column.getHeaderProps(column.getSortByToggleProps())}>{column.render("Header")}
//                                 {column.canSort &&
//                                     (() => {
//                                         return (
//                                             <span>
//                                                 {column.isSorted ? column.isSortedDesc ? "🔽" : "🔼" : "" }
//                                             </span>
//                                         );
//                                     })
//                                 ()}
//                             </th>
//                         ))}
//                     </tr>
//                 ))}
//             </thead>
//             <tbody {...getTableBodyProps()}>
//                 {rows.map((row) => {
//                     prepareRow(row);
//                     return (
//                         <tr {...row.getRowProps()}>
//                             {row.cells.map((cell) => (
//                                 <td {...cell.getCellProps()}>
//                                     {cell.render("Cell")}
//                                 </td>
//                             ))}
//                         </tr>
//                     );
//                 })}
//             </tbody>
//         </table>
//     );
// };

export default Table;