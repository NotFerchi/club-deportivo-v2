import React from 'react';
import { Trophy } from 'lucide-react';

function EmptyState({ title, message }) {
  return (
    <div className="tb-empty-state">
      <Trophy size={34} />
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}

export default EmptyState;
