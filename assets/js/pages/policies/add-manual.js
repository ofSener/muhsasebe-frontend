    let currentStep = 1;
    const totalSteps = 4;

    function updateSteps() {
      // Update step indicators
      document.querySelectorAll('.wizard-step').forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        if (stepNum === currentStep) {
          step.classList.add('active');
        } else if (stepNum < currentStep) {
          step.classList.add('completed');
        }
      });

      // Update connectors
      document.querySelectorAll('.wizard-connector').forEach((conn, index) => {
        conn.classList.toggle('completed', index < currentStep - 1);
      });

      // Update panels
      document.querySelectorAll('.wizard-panel').forEach((panel, index) => {
        panel.classList.toggle('active', index + 1 === currentStep);
      });

      // Update buttons
      document.getElementById('prevBtn').style.display = currentStep > 1 ? 'flex' : 'none';
      document.getElementById('nextBtn').style.display = currentStep < totalSteps ? 'flex' : 'none';
      document.getElementById('submitBtn').style.display = currentStep === totalSteps ? 'flex' : 'none';
    }

    function nextStep() {
      if (currentStep < totalSteps) {
        currentStep++;
        updateSteps();
        if (currentStep === totalSteps) {
          updateSummary();
        }
      }
    }

    function prevStep() {
      if (currentStep > 1) {
        currentStep--;
        updateSteps();
      }
    }

    function selectCustomer(element) {
      document.querySelectorAll('.customer-result-item').forEach(item => {
        item.classList.remove('selected');
      });
      element.classList.add('selected');

      // Show selected customer
      document.getElementById('customerResults').style.display = 'none';
      document.getElementById('selectedCustomer').style.display = 'flex';
    }

    function clearCustomer() {
      document.getElementById('customerResults').style.display = 'block';
      document.getElementById('selectedCustomer').style.display = 'none';
      document.querySelectorAll('.customer-result-item').forEach(item => {
        item.classList.remove('selected');
      });
    }

    function showNewCustomerForm() {
      alert('Yeni müşteri formu açılıyor...');
    }

    function updateSummary() {
      document.getElementById('summaryPolicyNo').textContent = document.getElementById('policyNo').value || '-';
      document.getElementById('summaryAgency').textContent = document.getElementById('agencyCode').value || '-';

      const selectedType = document.querySelector('input[name="policyType"]:checked');
      document.getElementById('summaryType').textContent = selectedType ? selectedType.value.toUpperCase() : '-';

      document.getElementById('summaryCustomer').textContent = 'Kemal Yıldırım';
      document.getElementById('summaryTC').textContent = '12345678901';
      document.getElementById('summaryStartDate').textContent = document.getElementById('startDate').value || '-';
      document.getElementById('summaryEndDate').textContent = document.getElementById('endDate').value || '-';

      const premium = parseFloat(document.getElementById('premiumAmount').value) || 0;
      const rate = parseFloat(document.getElementById('commissionRate').value) || 0;
      const commission = premium * (rate / 100);

      document.getElementById('summaryPremium').textContent = premium.toLocaleString('tr-TR', {minimumFractionDigits: 2}) + ' TL';
      document.getElementById('summaryCommission').textContent = commission.toLocaleString('tr-TR', {minimumFractionDigits: 2}) + ' TL';
    }

    function saveDraft() {
      alert('Taslak kaydedildi!');
    }

    function submitPolicy() {
      alert('Poliçe başarıyla kaydedildi!');
      window.location.href = 'my-policies.html';
    }

    // Commission preview update
    document.addEventListener('DOMContentLoaded', function() {
      requirePermission('policeDuzenleyebilsin');

      const premiumInput = document.getElementById('premiumAmount');
      const rateInput = document.getElementById('commissionRate');

      function updatePreview() {
        const premium = parseFloat(premiumInput.value) || 0;
        const rate = parseFloat(rateInput.value) || 0;
        const commission = premium * (rate / 100);

        document.getElementById('previewPremium').textContent = premium.toLocaleString('tr-TR', {minimumFractionDigits: 2}) + ' TL';
        document.getElementById('previewRate').textContent = '%' + rate;
        document.getElementById('previewCommission').textContent = commission.toLocaleString('tr-TR', {minimumFractionDigits: 2}) + ' TL';
      }

      premiumInput?.addEventListener('input', updatePreview);
      rateInput?.addEventListener('input', updatePreview);
    });
