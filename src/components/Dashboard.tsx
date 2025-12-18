import { useEffect, useState } from 'react';
import { Package, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Loader2 } from 'lucide-react';

import { InventoryItem, Transaction } from '../types';

const SHEET_API_URL = import.meta.env.VITE_SHEET_API_URL || "";
const SHEET_NAME_INVENTORY = import.meta.env.VITE_SHEET_NAME_INVENTORY || "Inventory";
const SHEET_NAME_HISTORY = import.meta.env.VITE_SHEET_NAME_HISTORY || "History";

export default function Dashboard() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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
          // Use lh3.googleusercontent.com directly to minimize redirects and cookie checks
          return `https://lh3.googleusercontent.com/d/${id}=w400`;
      }
      return url;
    } catch (e) {
      return url;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // 2. Fetch Inventory
      const invResponse = await fetch(`${SHEET_API_URL}?sheet=${SHEET_NAME_INVENTORY}&ts=${Date.now()}`);
      const invResult = await invResponse.json();
      let newInventory: InventoryItem[] = [];

      if (invResult.success && invResult.data) {
        const data = invResult.data;
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row[3]) { // Product Name
             const driveLink = row[2] || '';
             const displayImage = getDisplayableImageUrl(driveLink) || '';
             
             newInventory.push({
               id: `${i}`,
               createdAt: row[0] || '',
               inventoryNo: row[1] || '',
               image: displayImage,
               name: row[3] || '',
               productCode: row[4] || '',
               brand: row[5] || '',
               model: row[6] || '',
               size: row[7] || '',
               color: row[8] || '',
               price: parseFloat(row[9]) || 0,
               specification: row[10] || '',
               openingQty: parseInt(row[11]) || 0,
               totalIn: parseInt(row[12]) || 0,
               totalOut: parseInt(row[13]) || 0,
               qty: parseInt(row[14]) || 0,
               stockValue: parseFloat(row[15]) || 0,
               lastPurchaseDate: row[16] || '',
               lastSalesDate: row[17] || '',
             });
          }
        }
        setInventory(newInventory);
      }

      // 3. Fetch History
      const histResponse = await fetch(`${SHEET_API_URL}?sheet=${SHEET_NAME_HISTORY}&ts=${Date.now()}`);
      const histResult = await histResponse.json();
      let newTransactions: Transaction[] = [];

      if (histResult.success && histResult.data) {
         const data = histResult.data;
         for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[1]) {
               newTransactions.push({
                 id: `${i}`,
                 date: row[0] || '',
                 serialNumber: row[1] || '',
                 status: (row[2]?.toUpperCase() === 'IN' ? 'IN' : 'OUT') as 'IN' | 'OUT',
                 vendorName: row[3] || '',
                 qty: parseInt(row[4]) || 0,
               });
            }
         }
         const sortedTxns = newTransactions.reverse();
         setTransactions(sortedTxns);
      }

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Metrics

  const totalStockCount = inventory.reduce((sum, item) => sum + item.qty, 0);
  // Total Value: Use Stock Value column (Col P) or calculate? Inventory has 'stockValue'. Use that.
  const totalValue = inventory.reduce((sum, item) => sum + (item.stockValue || 0), 0);
  
  const inTransactions = transactions.filter((t) => t.status === 'IN').length;
  const outTransactions = transactions.filter((t) => t.status === 'OUT').length;

  const recentTransactions = transactions.slice(0, 5); // Already reversed

  const stats = [
    {
      label: 'Total Stock',
      value: totalStockCount,
      icon: Package,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: 'Stock Value',
      value: `₹${totalValue.toLocaleString()}`,
      icon: IndianRupee,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      label: 'Product IN',
      value: inTransactions,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      label: 'Product OUT',
      value: outTransactions,
      icon: TrendingDown,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
    },
  ];

  if (loading) {
      return (
          <div className="flex h-full items-center justify-center min-h-[60vh]">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <span className="ml-3 text-lg font-medium text-gray-600">Loading Dashboard...</span>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items */}
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition duration-300">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <ShoppingCart className="w-5 h-5 mr-2 text-blue-600" />
            Low Stock Items
          </h3>
          <div className="space-y-3">
            {inventory
              .filter((item) => item.qty < 10) // Threshold 10
              .slice(0, 5)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {item.image ? (
                        <img
                        src={item.image}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover"
                        referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-500">N/A</div>
                    )}
                    
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.inventoryNo}</p>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap ml-2">
                    <p className="text-base font-bold text-orange-600">{item.qty}</p>
                    <p className="text-[10px] text-gray-500 uppercase">units left</p>
                  </div>
                </div>
              ))}
            {inventory.filter((item) => item.qty < 10).length === 0 && (
              <p className="text-gray-500 text-center py-4 text-sm">All items are well stocked!</p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition duration-300">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            Recent Transactions
          </h3>
          <div className="space-y-3">
            {recentTransactions.map((txn, index) => {
              // Find item details
              const item = inventory.find(i => i.inventoryNo === txn.serialNumber);
              
              return (
              <div
                key={`${txn.id}-${index}`}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  txn.status === 'IN' ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      txn.status === 'IN' ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    {txn.status === 'IN' ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{item ? item.name : txn.serialNumber}</p>
                    <p className="text-xs text-gray-500 truncate">{txn.vendorName || txn.serialNumber}</p>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap ml-2">
                  <p
                    className={`text-base font-bold ${
                      txn.status === 'IN' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {txn.status === 'IN' ? '+' : '-'}
                    {txn.qty}
                  </p>
                  <p className="text-xs text-gray-500">{txn.date ? txn.date.split('T')[0] : ''}</p>
                </div>
              </div>
            )})}
            {recentTransactions.length === 0 && (
              <p className="text-gray-500 text-center py-4 text-sm">No recent transactions</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition duration-300">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Top Inventory Overview</h3>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {inventory.slice(0, 5).map((item) => (
              <div key={item.id} className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-700 truncate w-1/2">{item.name}</span>
                  <span className="text-xs text-gray-600">{item.qty} units</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      item.qty > 50
                        ? 'bg-green-500'
                        : item.qty > 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((item.qty / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
