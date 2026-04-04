import React from 'react';

const legalStyles = {
  container: {
    maxWidth: '800px',
    margin: '40px auto',
    padding: '40px',
    lineHeight: '1.6',
    color: 'var(--text-main)',
    textAlign: 'left',
  },
  header: {
    fontSize: '32px',
    marginBottom: '24px',
    fontWeight: '800',
    color: '#fff',
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '16px',
  },
  section: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: 'var(--primary)',
  },
  text: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    marginBottom: '10px',
  },
  backButton: {
    display: 'inline-block',
    marginBottom: '20px',
    color: 'var(--primary)',
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600'
  }
};

export const PrivacyPolicy = ({ onBack }) => (
  <div style={legalStyles.container} className="glass-panel animate-fade-in">
    <div onClick={onBack} style={legalStyles.backButton}>← Back to Login</div>
    <h1 style={legalStyles.header}>Privacy Policy</h1>
    
    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>1. Information We Collect</h2>
      <p style={legalStyles.text}>BAS Accounting ("we," "our," or "us") collects information you provide directly, such as when you create an account, including your email address (specifically chigoziemartins00@gmail.com for support), business name, and business data.</p>
    </div>

    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>2. How We Use Information</h2>
      <p style={legalStyles.text}>We use your information to provide, maintain, and improve our accounting services, process transactions, and communicate with you about your account.</p>
    </div>

    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>3. Data Storage & Security (Firebase)</h2>
      <p style={legalStyles.text}>We use Google Firebase to securely store your authentication data and business records. Your data is encrypted in transit and at rest using industry-standard protocols.</p>
    </div>

    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>4. Your Rights</h2>
      <p style={legalStyles.text}>You have the right to access, correct, or delete your personal data at any time through the application settings.</p>
    </div>

    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>5. Contact</h2>
      <p style={legalStyles.text}>For any privacy concerns, contact us at chigoziemartins00@gmail.com.</p>
    </div>
  </div>
);

export const TermsOfService = ({ onBack }) => (
  <div style={legalStyles.container} className="glass-panel animate-fade-in">
    <div onClick={onBack} style={legalStyles.backButton}>← Back to Login</div>
    <h1 style={legalStyles.header}>Terms of Service</h1>
    
    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>1. Acceptance of Terms</h2>
      <p style={legalStyles.text}>By using BAS Accounting, you agree to comply with these terms. If you do not agree, please do not use the service.</p>
    </div>

    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>2. User Accounts</h2>
      <p style={legalStyles.text}>You are responsible for maintaining the confidentiality of your account and password. You agree to notify us immediately of any unauthorized use of your account.</p>
    </div>

    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>3. Business Data Ownership</h2>
      <p style={legalStyles.text}>Users retain all rights to the business data they input into the platform. We do not claim ownership over your data.</p>
    </div>

    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>4. Prohibited Uses</h2>
      <p style={legalStyles.text}>You may not use the platform for any illegal activities or to transmit harmful code or malware.</p>
    </div>

    <div style={legalStyles.section}>
      <h2 style={legalStyles.title}>5. Limitation of Liability</h2>
      <p style={legalStyles.text}>BAS Accounting is provided "as is" without warranty of any kind. We are not liable for any financial losses or data inaccuracies resulting from the use of the software.</p>
    </div>
  </div>
);
