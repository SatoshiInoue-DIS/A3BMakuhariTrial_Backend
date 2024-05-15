export const columns = [
    { Header: "商品", accessor: "product" },
    { Header: "値段", accessor: "price" },
    { Header: "在庫", accessor: "stock" }
];

export const data = [
    {
      product: "りんご",
      price: "120円",
      stock: "130"
    },
    {
      product: "バナナ",
      price: "100円",
      stock: "200"
    },
    {
      product: "メロン",
      price: "3400円",
      stock: "2"
    }
];

// export type Data = {
//   col1: string;
//   col2: string;
// };

export type Data = {
    filename: string;
    size: number;
    last_modified: string;
    delete: boolean | undefined;
};
