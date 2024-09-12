import { SevedFileResponse, deleteApi, generateId, checkProgress } from "../../api";

import React, { forwardRef, useRef, useEffect, useState } from 'react';
import { useTable, Column, useSortBy, useRowSelect } from 'react-table';
import Router, { useRouter } from 'next/router';
import styles from './Table.module.css';
import Image from "next/image"

type Props = {
    tableColumns: any;
    files: SevedFileResponse[];
};

type DocRegistrationProps = {  
    addProgressPair: (progress: number, requestId: string, jobType: string, bot: string, isComp: boolean, fileName: string, failedFiles: File[]) => void;  
};

interface IIndeterminateInputProps {
    indeterminate?: boolean;
    name: string;
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


const Table = ({ columns, data, callback, bot, setIsDeleting, setDeleteComp, isDeleting, deleteComp, addProgressPair }: 
    { 
        columns: Column<SevedFileResponse>[]; 
        data: SevedFileResponse[]; 
        callback: (selected: SevedFileResponse[]) => void; 
        bot: string;
        setIsDeleting: React.Dispatch<React.SetStateAction<boolean>>; 
        setDeleteComp: React.Dispatch<React.SetStateAction<boolean>>; 
        isDeleting:boolean; 
        deleteComp:boolean;
        addProgressPair: (progress: number, requestId: string, jobType: string, bot: string, isComp: boolean, fileName: string, failedFiles?: { file: File; isUploaded: boolean }[] | undefined, failedFilesString?: string[] | undefined ) => void;
    }) => {
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
                        // 型アサーションを使用
                        const fileNameComponent = row.original.filename as unknown as React.ReactElement;
                        const fileName = (fileNameComponent.props.children[1] as React.ReactElement).props.children;
                        // const fileName = row.original.filename.props.children[1].props.children;
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
    
    const [deleteProgress, setDeleteProgress] = useState<number>(0);

    const makeApiRequest = async (filename: {filename: string}[], bot: string, isdel: boolean, delcom: boolean) => {
        const executePermission = confirm("本当に削除しますか？")
        if (executePermission) {
            const job_type = "oneDelete"
            const one_delete_id = generateId()
            try {
                // fileの名前を取得
                const file_name = filename.length > 0 ? filename[0].filename : "";
                addProgressPair(0, one_delete_id, job_type, bot, false, file_name);
                // 進行状況の確認を開始
                const checkProgressPromise = checkProgress(one_delete_id, (newProgress: number) => {  
                    setDeleteProgress(newProgress);  
                    addProgressPair(newProgress, one_delete_id, job_type, bot, false, file_name);
                });
                const response = await deleteApi(filename, bot, one_delete_id);
                // checkProgressPromiseの結果を待つ
                const progressResult = await checkProgressPromise;
                const { progress, isComp } = progressResult;
                // 進行状況が100未満かつ、失敗したファイルが存在するかを確認
                if (progress < 100 && response.failed_files && response.failed_files?.length > 0) {
                    const failed_files_string = response.failed_files || [];
                    if (failed_files_string.length > 0) {
                        addProgressPair(progress, one_delete_id, job_type, bot, isComp, file_name, undefined, failed_files_string);
                    }
                } else {
                    addProgressPair(progress, one_delete_id, job_type, bot, isComp, file_name);
                }
            } catch (e) {
                alert(`削除処理中にエラーが発生しました: ${e}`);
            } finally {
            }
        }
    };
    
    useEffect(() => { callback(selectedFlatRows.map((d) => d.original)); }, [callback, selectedFlatRows]);
    
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
            </table>
        </>
    );
};

Table.displayName = 'Table';

export default Table;
