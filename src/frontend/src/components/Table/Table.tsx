import { SevedFileResponse, deleteApi } from "../../api";

import React, { forwardRef, useRef, useEffect } from 'react';
import { useTable, Column, useSortBy, useRowSelect } from 'react-table';
import Router, { useRouter } from 'next/router';
import styles from './Table.module.css';
import Image from "next/image"

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

IndeterminateCheckbox.displayName = 'IndeterminateCheckbox';


const Table = ({ columns, data, callback, bot, setIsDeleting, setDeleteComp, isDeleting, deleteComp }: { columns: Column<SevedFileResponse>[]; data: SevedFileResponse[]; callback: (selected: SevedFileResponse[]) => void; bot: string; setIsDeleting: React.Dispatch<React.SetStateAction<boolean>>; setDeleteComp: React.Dispatch<React.SetStateAction<boolean>>; isDeleting:boolean; deleteComp:boolean;}) => {
    const router = useRouter()
    
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
        return (
            <button className={styles.one_del_btn} onClick={() => makeApiRequest(filename, bot, true, false)}>
                <Image src="./garbage_can_icon.png" width={20} height={20} alt="garbage_can_icon"></Image>
            </button>
        )
    }
    
    const makeApiRequest = async (filename: {filename: string}[], bot: string, isdel: boolean, delcom: boolean) => {
        const executePermission = confirm("本当に削除しますか？")
        if (executePermission) {
            setIsDeleting(isdel)
            setDeleteComp(delcom)
            try {
                const response = await deleteApi(filename, bot);
                const findErrorFromResponse = response.some((res) => res.answer = false)
                if (!findErrorFromResponse) {
                    setIsDeleting(false)
                    setDeleteComp(true)
                }
            } catch (e) {
                alert(`削除処理中にエラーが発生しました: ${e}`);
            } finally {
            }
        }
    };
    
    useEffect(() => { callback(selectedFlatRows.map((d) => d.original)); }, [callback, selectedFlatRows]);
    
    const comp = () => {
        setIsDeleting(false)
        setDeleteComp(false)
        router.reload()
    }

    return (
        <>
            <table className={styles.doc_table} {...getTableProps()}>
                <thead className={styles.doc_thead}>
                    {headerGroups.map((headerGroup) => {
                        const { key, ...restHeaderGroupProps } = headerGroup.getHeaderGroupProps();
                        return (
                            <tr {...restHeaderGroupProps} key={key}>
                                {headerGroup.headers.map((column) => {
                                    const { key, ...restColumn } = column.getHeaderProps(
                                        column.getSortByToggleProps()
                                    );
                                    return (
                                        <th className={styles.doc_cell_head} {...restColumn} key={key}>
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
                {!deleteComp ? (
                    <>
                        {isDeleting ? (
                            <>
                                <div>
                                    <p>削除中です。</p>
                                </div>
                            </>
                        ) : (
                            <tbody className={styles.doc_tbody} {...getTableBodyProps()}>
                                {rows.map((row) => {
                                    prepareRow(row);
                                    const { key, ...restRowProps } = row.getRowProps();
                                    return (
                                        <tr {...restRowProps} key={key}>
                                            {row.cells.map((cell) => {
                                                const { key, ...restCellProps } = cell.getCellProps();
                                                return (
                                                    <td className={styles.doc_cell} {...restCellProps} key={key}>
                                                        {cell.render('Cell')}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        )}
                    </>
                ) : (
                    <>
                        <p>削除が完了しました。</p>
                        <button type="button" onClick={comp}>OK</button>
                    </>
                )}
            </table>
        </>
    );
};

Table.displayName = 'Table';

export default Table;