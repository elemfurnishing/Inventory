import { useEffect, useState } from 'react';
import { Transaction } from '../types';
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';


const SHEET_API_URL = import.meta.env.VITE_SHEET_API_URL || "";
const SHEET_NAME_HISTORY = import.meta.env.VITE_SHEET_NAME_HISTORY || "History";

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendor, setFilterVendor] = useState('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    
    // Check if it's already in DD/MM/YYYY format or similar simple format
    // But basic ISO string check is prioritized
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (e) {
      // ignore
    }

    if (dateString.includes('T')) {
       return dateString.split('T')[0].split('-').reverse().join('/');
    }

    if (dateString.includes(' ')) {
      return dateString.split(' ')[0];
    }
    return dateString;
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${SHEET_API_URL}?sheet=${SHEET_NAME_HISTORY}&ts=${Date.now()}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        const txns: Transaction[] = [];
        
        // Start from row 2 (index 1) assuming header row
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          // Check if Serial Number (Col B, index 1) exists
          if (row[1]) { 
            txns.push({
              id: `${i}`,
              date: row[0] || '',                    // Col A: Timestamp
              serialNumber: row[1] || '',            // Col B: Serial Number
              status: (row[2]?.toUpperCase() === 'IN' ? 'IN' : 'OUT') as 'IN' | 'OUT', // Col C: Status
              vendorName: row[3] || '',              // Col D: Vendor Name
              qty: parseInt(row[4]) || 0,            // Col E: Qty
            });
          }
        }
        
        const sortedTxns = txns.reverse();
        setTransactions(sortedTxns);

      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique vendor names for the filter dropdown
  const vendorNames = Array.from(new Set(transactions.map((t) => t.vendorName).filter(Boolean)));

  const filteredTransactions = transactions.filter((t) => {
    const matchesFilter = filter === 'ALL' ? true : t.status === filter;
    const matchesSearch =
      t.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesVendor = filterVendor ? t.vendorName === filterVendor : true;

    return matchesFilter && matchesSearch && matchesVendor;
  });

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-lg">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 whitespace-nowrap">
          Transaction History
        </h2>

        <div className="flex flex-col md:flex-row gap-4 flex-1 md:mx-4">
             <div className="relative flex-1">
                 <input 
                     type="text" 
                     placeholder="Search by Vendor or Serial No..." 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-4 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:bg-gray-100 placeholder-gray-400 text-sm"
                 />
             </div>
             <select
                 value={filterVendor}
                 onChange={(e) => setFilterVendor(e.target.value)}
                 className="w-full md:w-48 px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:bg-gray-100 cursor-pointer text-sm"
             >
                 <option value="">All Vendors</option>
                 {vendorNames.map(name => (
                     <option key={name} value={name}>{name}</option>
                 ))}
             </select>
        </div>

        <div className="flex p-1 bg-gray-50 rounded-lg border border-gray-100 shadow-inner shrink-0">
          {(['ALL', 'IN', 'OUT'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                filter === type
                  ? 'bg-white text-blue-600 shadow-sm scale-105'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {type === 'ALL' ? 'All' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <span className="ml-3 text-lg font-medium text-gray-600">Loading History...</span>
        </div>
      ) : (
      <>
      <div className="hidden md:block bg-white rounded-xl shadow-lg border border-gray-100 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="overflow-auto h-full relative no-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap box-border border-b border-gray-200 shadow-sm">
                  Timestamp
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap box-border border-b border-gray-200 shadow-sm">
                  Serial Number
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap box-border border-b border-gray-200 shadow-sm">
                  Status
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap box-border border-b border-gray-200 shadow-sm">
                  Vendor Name
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap box-border border-b border-gray-200 shadow-sm">
                  Qty
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                 <tr><td colSpan={5} className="text-center py-4">Loading...</td></tr>
              ) : filteredTransactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-600">{formatDate(txn.date)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-800 text-xs">{txn.serialNumber}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        txn.status === 'IN'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {txn.status === 'IN' ? (
                        <ArrowDownCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <ArrowUpCircle className="w-3 h-3 mr-1" />
                      )}
                      {txn.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-600">{txn.vendorName || '-'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-800">{txn.qty}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTransactions.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </div>

      <div className="md:hidden space-y-4">
        {filteredTransactions.map((txn) => (
          <div key={txn.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-start space-x-4">
              {/* Removed image and item name as per new schema */}
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-sm">{txn.vendorName || 'Unknown Vendor'}</h3>
                    <p className="text-xs text-gray-500">{txn.serialNumber}</p>
                    {/* Removed inventoryNo as per new schema */}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      txn.status === 'IN'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {txn.status === 'IN' ? (
                      <ArrowDownCircle className="w-3 h-3 mr-1" />
                    ) : (
                      <ArrowUpCircle className="w-3 h-3 mr-1" />
                    )}
                    {txn.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium text-gray-800">{formatDate(txn.date)}</p>
                </div>
                <div>
                    <p className="text-gray-500">Quantity</p>
                    <p className="font-medium text-gray-800">{txn.qty}</p>
                  </div>
                  {/* Removed Price and Total as per new schema */}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredTransactions.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
