'use client'
export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth:'800px', margin:'0 auto', padding:'40px 24px', fontFamily:"'DM Sans',-apple-system,sans-serif", fontSize:'14px', color:'#374151', lineHeight:'1.7' }}>
      <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#111', marginBottom:'8px' }}>Privacy Policy</h1>
      <p style={{ color:'#9ca3af', marginBottom:'32px' }}>Jamo Packaging Solutions Ltd | Last updated: April 2026</p>

      <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#111', marginTop:'24px', marginBottom:'8px' }}>1. Introduction</h2>
      <p>Jamo TaskFlow ("the App") is an internal operations and CRM system operated by Jamo Packaging Solutions Ltd, registered in the United Kingdom. This Privacy Policy explains how we collect, use, and protect information when you use our application.</p>

      <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#111', marginTop:'24px', marginBottom:'8px' }}>2. Information We Collect</h2>
      <p>We collect and process the following information:</p>
      <ul style={{ paddingLeft:'20px', marginTop:'8px' }}>
        <li>Business contact information (name, email, phone, company name)</li>
        <li>Order and transaction data from connected marketplaces</li>
        <li>Invoice and payment data from QuickBooks Online</li>
        <li>Internal task and communication records</li>
      </ul>

      <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#111', marginTop:'24px', marginBottom:'8px' }}>3. How We Use Information</h2>
      <p>Information collected is used solely for internal business operations including:</p>
      <ul style={{ paddingLeft:'20px', marginTop:'8px' }}>
        <li>Managing customer relationships and orders</li>
        <li>Processing invoices and tracking payments via QuickBooks</li>
        <li>Internal team task management and communication</li>
        <li>Business reporting and analytics</li>
      </ul>

      <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#111', marginTop:'24px', marginBottom:'8px' }}>4. QuickBooks Integration</h2>
      <p>This application integrates with Intuit QuickBooks Online. When you connect QuickBooks, we access your accounting data solely to display invoice information and create invoices on your behalf. We do not sell or share your QuickBooks data with third parties. Your QuickBooks credentials are stored securely using industry-standard encryption.</p>

      <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#111', marginTop:'24px', marginBottom:'8px' }}>5. Data Storage and Security</h2>
      <p>All data is stored securely on Supabase infrastructure hosted in the European Union. We implement industry-standard security measures including encryption at rest and in transit, row-level security, and access controls.</p>

      <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#111', marginTop:'24px', marginBottom:'8px' }}>6. Data Sharing</h2>
      <p>We do not sell, trade, or share your personal or business data with third parties, except as required by law or to provide the services described above.</p>

      <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#111', marginTop:'24px', marginBottom:'8px' }}>7. Your Rights</h2>
      <p>You have the right to access, correct, or delete your data. To exercise these rights, contact us at: <strong>info@jamosolutions.co.uk</strong></p>

      <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#111', marginTop:'24px', marginBottom:'8px' }}>8. Contact</h2>
      <p>Jamo Packaging Solutions Ltd<br/>Unit C8, Texcel Business Park, Dartford DA1 4SB, United Kingdom<br/>Email: info@jamosolutions.co.uk</p>

      <p style={{ marginTop:'32px', color:'#9ca3af', fontSize:'12px' }}>This privacy policy applies to the internal TaskFlow application and its integrations.</p>
    </div>
  )
}
