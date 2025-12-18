export interface User {
  username: string; // Used in AuthContext (mapped from userName or userId)
  role: string;     // Changed from 'admin' | 'user' to string to support "User", "Admin" etc.
  password?: string;
  pageAccess?: string[];
  displayName?: string;

  // Settings / Sheet fields
  id?: number;
  serialNo?: string;
  userName?: string; // Sheet Column B
  userId?: string;   // Sheet Column C
  rowIndex?: number;
}

export interface InventoryItem {
  id: string;
  inventoryNo: string;
  productCode: string;
  name: string;
  price: number;
  qty: number;
  image: string;
  createdAt: string;
  brand?: string;
  model?: string;
  size?: string;
  color?: string;
  location?: string;
  specification?: string;
  openingQty?: number;
  stockValue?: number;
  totalIn?: number;
  totalOut?: number;
  lastPurchaseDate?: string;
  lastSalesDate?: string;
}

export interface Transaction {
  id: string;
  date: string;
  serialNumber: string;
  status: 'IN' | 'OUT';
  vendorName: string;
  qty: number;
  // Optional legacy fields if needed for other components not yet updated, 
  // but strictly speaking the prompt implies a schema change.
  // I'll keep it clean.
}
