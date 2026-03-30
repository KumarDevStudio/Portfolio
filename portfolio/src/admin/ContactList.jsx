// src/components/admin/ContactList.jsx (Updated)
import React from 'react';
import { toast } from 'react-toastify';
import { Check, Trash2, Mail } from 'lucide-react';
import AnimatedSection from '../ui/AnimatedSection';
import Button from '../ui/Button';
import Card from '../ui/Card';
import * as api from '../../services/api';

const ContactList = ({
  contacts,
  setContacts,
  selectedItems,
  setSelectedItems,
  actionLoading,
  setActionLoading,
  token,
  currentPage,
  itemsPerPage,
  sortConfig,
  setFormData,
}) => {
  const handleMarkRead = async (id) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await api.markContactRead(id, token);
      setContacts(contacts.map((contact) => (contact._id === id ? response.data : contact)));
      toast.success('Marked as read!', { position: 'top-right' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark as read', { position: 'top-right' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = (id) => {
    api.showConfirmationModal({
      message: 'Are you sure you want to delete this contact?',
      onConfirm: async () => {
        setActionLoading((prev) => ({ ...prev, [id]: true }));
        try {
          await api.deleteContact(id, token);
          setContacts(contacts.filter((c) => c._id !== id));
          setSelectedItems(selectedItems.filter((itemId) => itemId !== id));
          toast.success('Contact deleted successfully!', { position: 'top-right' });
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to delete contact', { position: 'top-right' });
        } finally {
          setActionLoading((prev) => ({ ...prev, [id]: false }));
        }
      },
    });
  };

  const handleReply = (contact) => {
    setFormData({ _id: contact._id, replyMessage: '' });
  };

  const toggleItemSelection = (id) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const sortData = (data) => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      if (typeof aValue === 'string') {
        return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  const paginatedData = sortData(contacts).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      {paginatedData.map((contact, index) => (
        <AnimatedSection key={contact._id} animation="fadeInUp" delay={index * 0.1}>
          <Card className={`p-6 bg-white/90 dark:bg-gray-800/90 ${contact.status === 'read' ? 'opacity-80' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(contact._id)}
                  onChange={() => toggleItemSelection(contact._id)}
                  className="mt-1 h-4 w-4 text-indigo-600 rounded"
                  aria-label={`Select contact from ${contact.name}`}
                  disabled={actionLoading[contact._id]}
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{contact.name}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{contact.email}</p>
                  {contact.subject && <p className="text-gray-600 dark:text-gray-300 font-medium">{contact.subject}</p>}
                  <p className="text-gray-600 dark:text-gray-300 mt-2 line-clamp-3">{contact.message}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{new Date(contact.createdAt).toLocaleString()}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status: {contact.status}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {contact.status !== 'read' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkRead(contact._id)}
                    disabled={actionLoading[contact._id]}
                  >
                    {actionLoading[contact._id] ? '...' : <Check size={16} className="mr-1" />}
                    Mark as Read
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReply(contact)}
                  disabled={actionLoading[contact._id]}
                >
                  <Mail size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(contact._id)}
                  disabled={actionLoading[contact._id]}
                >
                  {actionLoading[contact._id] ? '...' : <Trash2 size={16} />}
                </Button>
              </div>
            </div>
          </Card>
        </AnimatedSection>
      ))}
      {contacts.length === 0 && (
        <AnimatedSection>
          <Card className="p-8 text-center bg-white/90 dark:bg-gray-800/90">
            <p className="text-gray-600 dark:text-gray-300">No contacts found</p>
          </Card>
        </AnimatedSection>
      )}
      {contacts.length > itemsPerPage && (
        <AnimatedSection>
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              Previous
            </Button>
            <span className="text-gray-600 dark:text-gray-300">
              Page {currentPage} of {Math.ceil(contacts.length / itemsPerPage)}
            </span>
            <Button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * itemsPerPage >= contacts.length}
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              Next
            </Button>
          </div>
        </AnimatedSection>
      )}
    </div>
  );
};

export default ContactList;