import { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, ArrowDownCircle, ArrowUpCircle, X, Upload, Camera, Loader, Loader2 } from 'lucide-react';
import { Transaction } from '../types';


const SHEET_API_URL = import.meta.env.VITE_SHEET_API_URL || "";
const FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID || "";
const SHEET_NAME_INVENTORY = import.meta.env.VITE_SHEET_NAME_INVENTORY || "Inventory";
const SHEET_NAME_HISTORY = import.meta.env.VITE_SHEET_NAME_HISTORY || "History";

interface InventoryItem {
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
  totalIn?: number;
  totalOut?: number;
  stockValue?: number;
  lastPurchaseDate?: string;
  lastSalesDate?: string;
  category?: string;
  customisationAvailable?: string;

}



export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInModal, setShowInModal] = useState(false);
  const [showOutModal, setShowOutModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<InventoryItem | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    productCode: '',
    price: '',
    qty: '',
    image: '',
    brand: '',
    model: '',
    size: '',
    color: '',
    location: '',
    specification: '',
    category: '',
    customisationAvailable: '',
  });

  const [transactionData, setTransactionData] = useState({
    vendorName: '',
    qty: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Optimization: Memoize transaction aggregations
  const transactionStats = useMemo(() => {
    const stats: Record<string, { totalIn: number; totalOut: number }> = {};
    transactions.forEach(t => {
      if (!stats[t.serialNumber]) {
        stats[t.serialNumber] = { totalIn: 0, totalOut: 0 };
      }
      if (t.status === 'IN') {
        stats[t.serialNumber].totalIn += t.qty;
      } else {
        stats[t.serialNumber].totalOut += t.qty;
      }
    });
    return stats;
  }, [transactions]);

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      String(item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.inventoryNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.productCode && String(item.productCode).toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.brand && String(item.brand).toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesProduct = filterProduct ? item.name === filterProduct : true;

    return matchesSearch && matchesProduct;
  });

  const productNames = Array.from(new Set(inventory.map(item => item.name)));

  useEffect(() => {
    loadInventory();
    loadTransactions();
    loadCategories();
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (showCamera) {
      (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          alert("Could not access camera. Please ensure permissions are granted.");
          setShowCamera(false);
        }
      })();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCamera]);

  const uploadImageToDrive = async (base64Image: string, fileName: string): Promise<string> => {
    try {
      const response = await fetch(SHEET_API_URL, {
        method: 'POST',
        body: new URLSearchParams({
          action: 'uploadFile',
          base64Data: base64Image,
          fileName: fileName,
          mimeType: 'image/jpeg',
          folderId: FOLDER_ID,
        }),
      });

      const result = await response.json();
      if (result.success && result.fileUrl) {
        return result.fileUrl;
      } else {
        throw new Error(result.error || 'File upload failed');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${SHEET_API_URL}?sheet=Master Drop Down`);
      const result = await response.json();
      if (result.success && result.data) {
        // Assuming Row 1 is header, A2:A are values. Col A is index 0.
        const cats = result.data.slice(1)
            .map((r: any) => r[0])
            .filter((c: any) => c && String(c).trim() !== '');
        
        // Unique values just in case
        setCategories([...new Set(cats)] as string[]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };



  const loadInventory = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${SHEET_API_URL}?sheet=${SHEET_NAME_INVENTORY}&ts=${Date.now()}`);
    const result = await response.json();
    
    if (result.success && result.data) {
      const data = result.data;
      const items = [];
      
      // Start from row 2 (index 1) as per request (Assuming Row 1 is Header)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        
        // Check if Product Name (Column D, index 3) exists
        if (row[3]) {
          const driveLink = row[2] || '';
          const displayImage = getDisplayableImageUrl(driveLink) || '';

          items.push({
            id: `${i}`,
            createdAt: row[0] || '',       // Col A: Timestamp
            inventoryNo: row[1] || '',     // Col B: Serial No.
            image: displayImage,           // Col C: Product Image (Processed)
            name: row[3] || '',            // Col D: Product Name
            productCode: row[4] || '',     // Col E: Product Code
            brand: row[5] || '',           // Col F: Brand Name
            model: row[6] || '',           // Col G: Model
            size: row[7] || '',            // Col H: Size
            color: row[8] || '',           // Col I: Colour
            price: parseFloat(row[9]) || 0, // Col J: Amount
            specification: row[10] || '',  // Col K: Specification
            openingQty: parseInt(row[11]) || 0, // Col L: Opening Qty
            totalIn: parseInt(row[12]) || 0,    // Col M: Total In Qty
            totalOut: parseInt(row[13]) || 0,   // Col N: Total Out Qty
            qty: parseInt(row[14]) || 0,        // Col O: Current Level
            stockValue: parseFloat(row[15]) || 0, // Col P: Stock Value
            lastPurchaseDate: row[16] || '',    // Col Q: Last Purchase Date
            lastSalesDate: row[17] || '',       // Col R: Last Sales Date
            category: row[18] || '',            // Col S: Category
            customisationAvailable: row[19] || '', // Col T: Customisation Available
            
            // Compatibility / Raw fields
            imageUrl: driveLink,
          } as InventoryItem & { imageUrl: string });
        }
      }
      
      
      setInventory(items);
    }
  } catch (error) {
    console.error('Error loading inventory:', error);
    alert('Failed to load inventory data');
  } finally {
    setLoading(false);
  }
};

  const loadTransactions = async () => {
    try {
      const response = await fetch(`${SHEET_API_URL}?sheet=${SHEET_NAME_HISTORY}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        const txns: Transaction[] = [];
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[1]) { // Check if Serial Number (Col B) exists
            txns.push({
              id: `${i}`,
              date: row[0] || '',                    // Col A: Timestamp
              serialNumber: row[1] || '',            // Col B: Serial Number (Inventory No)
              status: (row[2]?.toUpperCase() === 'IN' ? 'IN' : 'OUT') as 'IN' | 'OUT', // Col C: Status
              vendorName: row[3] || '',              // Col D: Vendor Name
              qty: parseInt(row[4]) || 0,            // Col E: In/Out Qty
            });
          }
        }
        
        const sortedTxns = txns.reverse();
        setTransactions(sortedTxns);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

const getDisplayableImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  try {
    let id = '';
    const directMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (directMatch && directMatch[1]) id = directMatch[1];
    else {
      const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (ucMatch && ucMatch[1]) id = ucMatch[1];
      else {
        const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
        if (openMatch && openMatch[1]) id = openMatch[1];
        else {
            const anyIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
            if (anyIdMatch && anyIdMatch[1]) id = anyIdMatch[1];
        }
      }
    }

    if (id) {
        return `https://lh3.googleusercontent.com/d/${id}=w400`;
    }
    return url;
  } catch (e) {
    console.error("Error processing image URL:", url, e);
    return url;
  }
};

const getCurrentTimestamp = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const getCurrentDateFormatted = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // Fallback
  }

  if (dateString.includes('T')) {
      return dateString.split('T')[0].split('-').reverse().join('/');
  }

  if (dateString.includes(' ')) {
    return dateString.split(' ')[0];
  }
  return dateString;
};

  const getNextSerialNumber = async (): Promise<string> => {
    try {
      const response = await fetch(`${SHEET_API_URL}?sheet=${SHEET_NAME_INVENTORY}`);
      const result = await response.json();
      if (result.success && result.data) {
        const count = result.data.length - 1; // Subtract header
        return `SN-${String(count + 1).padStart(3, '0')}`;
      }
    } catch (error) {
      console.error('Error getting serial number:', error);
    }
    return 'SN-001';
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      let imageUrl = formData.image;
      if (formData.image && formData.image.startsWith('data:')) {
        imageUrl = await uploadImageToDrive(formData.image, `product-${Date.now()}.jpg`);
      }

      const serialNo = await getNextSerialNumber();
      const timestamp = getCurrentTimestamp();

      const rowData = [
        timestamp,           // Col A: Timestamp
        serialNo,            // Col B: Serial No.
        imageUrl,            // Col C: Product Image
        formData.name,       // Col D: Product Name
        formData.productCode, // Col E: Product Code
        formData.brand,      // Col F: Brand Name
        formData.model,      // Col G: Model
        formData.size,       // Col H: Size
        formData.color,      // Col I: Colour
        formData.price,      // Col J: Amount
        formData.specification, // Col K: Specification
        formData.qty,        // Col L: Opening Qty
        "",                  // Col M: Total In
        "",                  // Col N: Total Out
        "",                  // Col O: Current Level
        "",                  // Col P: Stock Value
        "",                  // Col Q: Last Purchase Date
        "",                  // Col R: Last Sales Date
        formData.category,   // Col S: Category
        formData.customisationAvailable, // Col T: Customisation Available
      ];

      const response = await fetch(SHEET_API_URL, {
        method: 'POST',
        body: new URLSearchParams({
          action: 'insert',
          sheetName: SHEET_NAME_INVENTORY,
          rowData: JSON.stringify(rowData),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setFormData({ name: '', productCode: '', price: '', qty: '', image: '', brand: '', model: '', size: '', color: '', location: '', specification: '', category: '', customisationAvailable: '' });
        setShowAddModal(false);
        await loadInventory();
      } else {
        alert('Failed to add inventory');
      }
    } catch (error) {
      console.error('Error adding inventory:', error);
      alert('Error adding inventory: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleInTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      setLoading(true);

      const timestamp = getCurrentDateFormatted(); // Use DD/MM/YYYY format

      const txnRowData = [
        timestamp,                   // Col A: Timestamp
        selectedItem.inventoryNo,    // Col B: Serial Number
        'IN',                        // Col C: Status
        transactionData.vendorName,  // Col D: Vendor Name
        transactionData.qty,         // Col E: In Qty
      ];

      const response = await fetch(SHEET_API_URL, {
        method: 'POST',
        body: new URLSearchParams({
          action: 'insert',
          sheetName: SHEET_NAME_HISTORY,
          rowData: JSON.stringify(txnRowData),
        }),
      });

      const result = await response.json();
      if (result.success) {

        
        setShowInModal(false);
        setSelectedItem(null);
        setTransactionData({ vendorName: '', qty: '', date: new Date().toISOString().split('T')[0] });
        await loadInventory();
        await loadTransactions();
      }
    } catch (error) {
      console.error('Error recording IN transaction:', error);
      alert('Error recording transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleOutTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const qtyOut = parseInt(transactionData.qty);
    if (qtyOut > selectedItem.qty) {
      alert('Quantity cannot exceed available stock!');
      return;
    }

    try {
      setLoading(true);

      const timestamp = getCurrentDateFormatted();

      const txnRowData = [
        timestamp,                   // Col A: Timestamp
        selectedItem.inventoryNo,    // Col B: Serial Number
        'OUT',                       // Col C: Status
        transactionData.vendorName,  // Col D: Vendor Name
        transactionData.qty,         // Col E: In Qty
      ];

      const response = await fetch(SHEET_API_URL, {
        method: 'POST',
        body: new URLSearchParams({
          action: 'insert',
          sheetName: SHEET_NAME_HISTORY,
          rowData: JSON.stringify(txnRowData),
        }),
      });

      const result = await response.json();
      if (result.success) {


        setShowOutModal(false);
        setSelectedItem(null);
        setTransactionData({ vendorName: '', qty: '', date: new Date().toISOString().split('T')[0] });
        await loadInventory();
        await loadTransactions();
      }
    } catch (error) {
      console.error('Error recording OUT transaction:', error);
      alert('Error recording transaction');
    } finally {
      setLoading(false);
    }
  };

  const openInModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setTransactionData({
      vendorName: '',
      qty: '',
      date: new Date().toISOString().split('T')[0],
    });
    setShowInModal(true);
  };

  const openOutModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setTransactionData({
      vendorName: '',
      qty: '',
      date: new Date().toISOString().split('T')[0],
    });
    setShowOutModal(true);
  };

  return (
    <div className="h-full flex flex-col gap-6 p-4">


      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-lg">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 hidden md:block whitespace-nowrap">
            Inventory Management
        </h2>

        <div className="flex flex-col md:flex-row gap-4 flex-1 md:mx-4">
             <div className="relative flex-1">
                 <input 
                     type="text" 
                     placeholder="Search by Name, ID, or Brand..." 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-4 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:bg-gray-100"
                 />
             </div>
             <select
                 value={filterProduct}
                 onChange={(e) => setFilterProduct(e.target.value)}
                 className="w-full md:w-48 px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:bg-gray-100 cursor-pointer"
             >
                 <option value="">All Products</option>
                 {productNames.map(name => (
                     <option key={name} value={name}>{name}</option>
                 ))}
             </select>
        </div>

        <div className="flex justify-end md:justify-start">
             <button
               onClick={() => setShowAddModal(true)}
               disabled={loading}
               className="flex items-center justify-center p-2 md:px-6 md:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50"
             >
               <Plus className="w-5 h-5 md:mr-2" />
               <span className="md:inline">Add Inventory</span>
             </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && inventory.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <span className="ml-3 text-lg font-medium text-gray-600">Loading Inventory...</span>
        </div>
      ) : (
      <>
      
      {/* Search and Filter */}

      <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-100 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="overflow-auto h-full relative">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Action</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Serial No.</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Product Image</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Product Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Product Code</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Brand Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Model</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Size</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Colour</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Specifications</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Opening Qty</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Total In Qty</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Total Out Qty</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Current Level</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Stock Value</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Last Purchase Date</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Last Sales Date</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Category</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Customisation</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.map((item) => {
                const stats = transactionStats[item.inventoryNo] || { totalIn: 0, totalOut: 0 };
                
                return (
                  <tr 
                    key={item.id} 
                    className="hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => {
                      setSelectedHistoryItem(item);
                      setShowHistoryModal(true);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openInModal(item)}
                          disabled={loading}
                          className="flex items-center px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition text-sm font-medium disabled:opacity-50"
                        >
                          <ArrowDownCircle className="w-4 h-4 mr-1" />
                          IN
                        </button>
                        <button
                          onClick={() => openOutModal(item)}
                          disabled={loading}
                          className="flex items-center px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium disabled:opacity-50"
                        >
                          <ArrowUpCircle className="w-4 h-4 mr-1" />
                          OUT
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-800 text-sm">{item.inventoryNo}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 rounded-lg object-cover"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
                         <span className="text-sm text-gray-400">No Image</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.productCode || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.brand || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.model || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.size || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.color || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-800">₹{item.price}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.specification || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.openingQty || 0}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-green-600">{stats.totalIn || 0}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-red-600">{stats.totalOut || 0}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          item.qty > 50
                            ? 'bg-green-100 text-green-800'
                            : item.qty > 20
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.qty}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-800">₹{item.stockValue?.toLocaleString() || '0'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{formatDate(item.lastPurchaseDate)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{formatDate(item.lastSalesDate)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.category || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.customisationAvailable || '-'}</span>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {filteredInventory.map((item) => {
          const stats = transactionStats[item.inventoryNo] || { totalIn: 0, totalOut: 0 };

          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start space-x-4">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center ${item.image ? 'hidden' : ''}`}>
                   <span className="text-xs text-gray-400">No Image</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{item.name}</h3>
                      <p className="text-xs text-gray-500">{item.inventoryNo}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.qty > 50
                          ? 'bg-green-100 text-green-800'
                          : item.qty > 20
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.qty}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-base font-bold text-gray-800">₹{item.price}</p>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs border-t border-b border-gray-100 py-3 mb-3">
                    <div className="flex flex-col">
                       <span className="text-gray-500">Brand</span>
                       <span className="font-medium text-gray-800 truncate">{item.brand || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Model</span>
                       <span className="font-medium text-gray-800 truncate">{item.model || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Product Code</span>
                       <span className="font-medium text-gray-800 truncate">{item.productCode || '-'}</span>
                    </div>
                     <div className="flex flex-col">
                       <span className="text-gray-500">Size</span>
                       <span className="font-medium text-gray-800 truncate">{item.size || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Color</span>
                       <span className="font-medium text-gray-800 truncate">{item.color || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Specs</span>
                       <span className="font-medium text-gray-800 truncate" title={item.specification}>{item.specification || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Category</span>
                       <span className="font-medium text-gray-800 truncate">{item.category || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Customisation</span>
                       <span className="font-medium text-gray-800 truncate">{item.customisationAvailable || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Opening Qty</span>
                       <span className="font-medium text-gray-800">{item.openingQty || 0}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Stock Value</span>
                       <span className="font-medium text-gray-800">₹{item.stockValue?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Stock In</span>
                       <span className="font-medium text-green-600">{stats.totalIn}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Stock Out</span>
                       <span className="font-medium text-red-600">{stats.totalOut}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Last Purchase</span>
                       <span className="font-medium text-gray-800">{formatDate(item.lastPurchaseDate)}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-gray-500">Last Sales</span>
                       <span className="font-medium text-gray-800">{formatDate(item.lastSalesDate)}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => openInModal(item)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition text-sm font-medium disabled:opacity-50"
                    >
                      <ArrowDownCircle className="w-4 h-4 mr-1" />
                      IN
                    </button>
                    <button
                      onClick={() => openOutModal(item)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium disabled:opacity-50"
                    >
                      <ArrowUpCircle className="w-4 h-4 mr-1" />
                      OUT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Add New Inventory</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleAddInventory} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Products Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Code *
                  </label>
                  <input
                    type="text"
                    value={formData.productCode}
                    onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                    <input
                      type="number"
                      value={formData.qty}
                      onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brand Name</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
                  <input
                    type="text"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Specification</label>
                  <input
                    type="text"
                    value={formData.specification}
                    onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat, index) => (
                        <option key={index} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Customisation Available</label>
                    <select
                      value={formData.customisationAvailable}
                      onChange={(e) => setFormData({ ...formData, customisationAvailable: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select Option</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
                <div className="flex flex-col space-y-2">
                  <div className="flex space-x-2">
                    <label className="flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition">
                      <Upload className="w-5 h-5 mr-2 text-gray-600" />
                      <span className="text-sm text-gray-600">Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e)}
                        className="hidden"
                      />
                    </label>
                    <label className="flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition cursor-pointer">
                      <Camera className="w-5 h-5 mr-2" />
                      Take Photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleImageUpload(e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  {/* Native camera replaces the custom video UI */}
                  {formData.image && (
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  )}
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(showInModal || showOutModal) && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => {
                setShowInModal(false);
                setShowOutModal(false);
                setSelectedItem(null);
              }}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              {showInModal ? 'Stock IN' : 'Stock OUT'}
            </h3>
            
            <div className="mb-6 bg-gray-50 p-4 rounded-lg flex gap-4">
                 {selectedItem.image && (
                    <img 
                      src={selectedItem.image} 
                      alt="Product" 
                      className="w-20 h-20 object-cover rounded-md border border-gray-200"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/150?text=No+Item+Image';
                      }} 
                    />
                 )}
                 <div className="flex-1 space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Serial Number</p>
                    <p className="text-sm font-bold text-gray-800">{selectedItem.inventoryNo}</p>
                    
                    <p className="text-xs text-gray-500 uppercase font-semibold mt-2">Product Name</p>
                    <p className="text-sm text-gray-800">{selectedItem.name}</p>

                    <div className="flex gap-4 mt-2">
                         <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Code</p>
                            <p className="text-sm text-gray-800">{selectedItem.productCode}</p>
                         </div>
                         <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Current Qty</p>
                            <p className="text-sm font-bold text-blue-600">{selectedItem.qty}</p>
                         </div>
                    </div>
                 </div>
            </div>

            <form onSubmit={showInModal ? handleInTransaction : handleOutTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={transactionData.vendorName}
                  onChange={(e) =>
                    setTransactionData({ ...transactionData, vendorName: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Enter vendor name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {showInModal ? "In Qty" : "Out Qty"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={transactionData.qty}
                  onChange={(e) =>
                    setTransactionData({ ...transactionData, qty: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Enter quantity"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 text-white py-2.5 rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm ${
                    showInModal ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInModal(false);
                    setShowOutModal(false);
                    setSelectedItem(null);
                  }}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && selectedHistoryItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
             <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                History for {selectedHistoryItem.name}
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedHistoryItem(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            <div className="p-6">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial No</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {transactions
                            .filter(t => t.serialNumber === selectedHistoryItem.inventoryNo)
                            .map(t => (
                                <tr key={t.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(t.date)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.serialNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.status === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.vendorName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.qty}</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      )}
      </>
      )}
      
      {/* History Modal */}
    </div>
  );
}

