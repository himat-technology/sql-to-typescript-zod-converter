import type { SqlPreset } from './types';

export const tsqlSaaS: SqlPreset = {
  id: 'tsql-saas',
  label: 'T-SQL SaaS Subscriptions',
  dialect: 'tsql',
  description: 'Tenants, plans, subscriptions and invoices with bracket identifiers, IDENTITY and GO batches.',
  sql: `-- SQL Server SaaS billing schema
CREATE TABLE [dbo].[Tenants] (
    [TenantId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Tenants_TenantId] DEFAULT NEWID(),
    [Name] NVARCHAR(200) NOT NULL,
    [Subdomain] NVARCHAR(63) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [DF_Tenants_IsActive] DEFAULT ((1)),
    [CreatedAt] DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Tenants] PRIMARY KEY CLUSTERED ([TenantId] ASC),
    CONSTRAINT [UQ_Tenants_Subdomain] UNIQUE NONCLUSTERED ([Subdomain])
);
GO

CREATE TABLE [dbo].[Plans] (
    [PlanId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Code] VARCHAR(32) NOT NULL UNIQUE,
    [DisplayName] NVARCHAR(100) NOT NULL,
    [MonthlyPrice] DECIMAL(10, 2) NOT NULL,
    [MaxSeats] INT NULL,
    [Features] NVARCHAR(MAX) NULL
);
GO

CREATE TABLE [dbo].[Subscriptions] (
    [SubscriptionId] BIGINT IDENTITY(1,1) NOT NULL,
    [TenantId] UNIQUEIDENTIFIER NOT NULL,
    [PlanId] INT NOT NULL,
    [Status] NVARCHAR(20) NOT NULL DEFAULT N'trialing'
        CHECK ([Status] IN (N'trialing', N'active', N'past_due', N'canceled')),
    [Seats] INT NOT NULL DEFAULT 1,
    [CurrentPeriodStart] DATETIMEOFFSET NOT NULL,
    [CurrentPeriodEnd] DATETIMEOFFSET NOT NULL,
    [CanceledAt] DATETIMEOFFSET NULL,
    CONSTRAINT [PK_Subscriptions] PRIMARY KEY ([SubscriptionId]),
    CONSTRAINT [FK_Subscriptions_Tenants] FOREIGN KEY ([TenantId]) REFERENCES [dbo].[Tenants] ([TenantId]),
    CONSTRAINT [FK_Subscriptions_Plans] FOREIGN KEY ([PlanId]) REFERENCES [dbo].[Plans] ([PlanId])
);
GO

CREATE TABLE [dbo].[Invoices] (
    [InvoiceId] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [SubscriptionId] BIGINT NOT NULL,
    [AmountDue] MONEY NOT NULL,
    [Currency] CHAR(3) NOT NULL DEFAULT 'USD',
    [Paid] BIT NOT NULL DEFAULT 0,
    [IssuedAt] DATETIME NOT NULL DEFAULT GETDATE(),
    [PdfBlob] VARBINARY(MAX) NULL
);
GO
`,
};
