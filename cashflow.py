# Cash Flow Management Tool
# Author: [Your Name]
# Date: 2026-06-19

class CashFlow:
    def __init__(self):
        self.transactions = []
    
    def add_transaction(self, description, amount, category):
        """Add a new transaction"""
        self.transactions.append({
            'description': description,
            'amount': amount,
            'category': category
        })
    
    def view_summary(self):
        """View transaction summary"""
        total_income = sum(t['amount'] for t in self.transactions if t['amount'] > 0)
        total_expenses = sum(t['amount'] for t in self.transactions if t['amount'] < 0)
        return {
            'total_income': total_income,
            'total_expenses': total_expenses,
            'net_flow': total_income + total_expenses
        }
    
    def generate_report(self, filename='cashflow_report.txt'):
        """Generate a text report"""
        summary = self.view_summary()
        with open(filename, 'w') as f:
            f.write(f"Cash Flow Report\n")
            f.write(f"-----------------\n")
            f.write(f"Total Income: ${summary['total_income']:.2f}\n")
            f.write(f"Total Expenses: -$ {abs(summary['total_expenses']):.2f}\n")
            f.write(f"Net Flow: ${summary['net_flow']:.2f}\n")