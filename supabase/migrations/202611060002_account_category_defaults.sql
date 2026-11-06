ALTER TABLE wallet.financial_accounts
 ADD COLUMN default_income_category_id uuid,
 ADD COLUMN default_expense_category_id uuid,
 ADD FOREIGN KEY(user_id,workspace_id,default_income_category_id) REFERENCES wallet.categories(user_id,workspace_id,id),
 ADD FOREIGN KEY(user_id,workspace_id,default_expense_category_id) REFERENCES wallet.categories(user_id,workspace_id,id);
