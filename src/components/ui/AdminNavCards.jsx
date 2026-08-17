import { useNavigate } from 'react-router-dom';

const CARDS = [
  { label: 'Compliance Act Category',    to: '/admin/act-type'     },
  { label: 'Compliance Act Subcategory', to: '/admin/act-sub-type' },
  { label: 'Login Access',               to: '/admin/login-access' },
];

export default function AdminNavCards() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none no-print">
      {CARDS.map((card) => (
        <button
          key={card.to}
          onClick={() => navigate(card.to)}
          className="nav-card-btn"
        >
          <span>{card.label}</span>
        </button>
      ))}
    </div>
  );
}
