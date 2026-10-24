-- CreateEnum
CREATE TYPE "EstadoEmpresa" AS ENUM ('ACTIVA', 'SUSPENDIDA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('PRUEBA', 'ACTIVA', 'VENCIDA', 'CANCELADA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('COMPRA', 'VENTA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR', 'AJUSTE', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CEDULA', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('COMPLETADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('BORRADOR', 'ENVIADA', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA', 'RECIBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoDevolucion" AS ENUM ('CLIENTE', 'PROVEEDOR');

-- CreateEnum
CREATE TYPE "EstadoDevolucion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "EstadoCredito" AS ENUM ('PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoSecuencia" AS ENUM ('FACTURA', 'ORDEN_COMPRA');

-- CreateEnum
CREATE TYPE "TipoDocumentoLegal" AS ENUM ('TERMINOS', 'PRIVACIDAD', 'TRATAMIENTO_DATOS');

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "titulo" VARCHAR(180) NOT NULL,
    "subtitulo" TEXT,
    "whatsapp" VARCHAR(30),
    "banners" JSONB NOT NULL DEFAULT '[]',
    "beneficios" JSONB NOT NULL DEFAULT '[]',
    "preguntasFaq" JSONB NOT NULL DEFAULT '[]',
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoLegal" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDocumentoLegal" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "contenido" TEXT NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoLegal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AceptacionLegal" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "aceptadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(45),
    "userAgent" VARCHAR(255),

    CONSTRAINT "AceptacionLegal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" TEXT,
    "precioMensual" DECIMAL(12,2) NOT NULL,
    "limiteUsuarios" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "ruc" VARCHAR(20),
    "regimenFiscal" VARCHAR(80),
    "direccion" VARCHAR(255) NOT NULL,
    "telefono" VARCHAR(20),
    "correo" VARCHAR(100),
    "logoUrl" TEXT,
    "eslogan" VARCHAR(150),
    "porcentajeIva" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "estado" "EstadoEmpresa" NOT NULL DEFAULT 'ACTIVA',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secuencia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoSecuencia" NOT NULL,
    "prefijo" VARCHAR(10) NOT NULL DEFAULT '',
    "ultimoValor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Secuencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suscripcion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "estado" "EstadoSuscripcion" NOT NULL DEFAULT 'PRUEBA',
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "precioPactado" DECIMAL(12,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "displayUsername" TEXT,
    "empresaId" TEXT,
    "rolId" TEXT,
    "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false,
    "passwordTemporalExpiraEn" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "padreId" TEXT,
    "descripcion" TEXT,
    "imagenUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadMedida" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "simbolo" VARCHAR(20) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnidadMedida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "categoriaId" TEXT,
    "codigoBarras" VARCHAR(100),
    "unidadMedidaId" TEXT,
    "precioCosto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precioBase" DECIMAL(12,2) NOT NULL,
    "precioOferta" DECIMAL(12,2),
    "precioMayorista" DECIMAL(12,2),
    "cantMinimaMayorista" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "imagenesUrl" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "nivelStockMinimo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "nivelStockMaximo" DECIMAL(14,3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "identificacionFiscal" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "tipoDocumento" "TipoDocumento",
    "numeroDocumento" VARCHAR(20),
    "direccion" VARCHAR(150),
    "telefono" VARCHAR(15),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "esGenerico" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionCaja" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "abiertoPorId" TEXT NOT NULL,
    "cerradoPorId" TEXT,
    "abiertoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),
    "efectivoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "efectivoCierre" DECIMAL(14,2),
    "efectivoEsperado" DECIMAL(14,2),
    "diferencia" DECIMAL(14,2),
    "totalVentas" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalEfectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTarjeta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalTransfer" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cantidadVentas" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,

    CONSTRAINT "SesionCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sesionCajaId" TEXT NOT NULL,
    "numeroFactura" VARCHAR(50) NOT NULL,
    "clienteId" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "montoDescuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montoIVA" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "referenciaPago" VARCHAR(100),
    "importeRecibido" DECIMAL(14,2),
    "cambio" DECIMAL(14,2),
    "estado" "EstadoVenta" NOT NULL DEFAULT 'COMPLETADA',
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleVenta" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "costoEnVenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "DetalleVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "numeroOrden" VARCHAR(50) NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'BORRADOR',
    "fechaEntregaEst" TIMESTAMP(3),
    "nota" TEXT,
    "usuarioId" TEXT NOT NULL,
    "aprobadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOrdenCompra" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadSolicitada" DECIMAL(14,3) NOT NULL,
    "cantidadRecibida" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "costoUnitario" DECIMAL(12,2) NOT NULL,
    "nota" TEXT,

    CONSTRAINT "ItemOrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoAlmacen" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "costoUnidad" DECIMAL(12,2),
    "proveedorId" TEXT,
    "ventaId" TEXT,
    "devolucionId" TEXT,
    "nota" TEXT,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoAlmacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devolucion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoDevolucion" NOT NULL,
    "ventaId" TEXT,
    "proveedorId" TEXT,
    "motivo" TEXT,
    "estado" "EstadoDevolucion" NOT NULL DEFAULT 'PENDIENTE',
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleDevolucion" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "motivo" TEXT,
    "estadoProducto" VARCHAR(60) NOT NULL,
    "reintegrarStock" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DetalleDevolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credito" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "ventaId" TEXT,
    "fechaCredito" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "montoOriginal" DECIMAL(14,2) NOT NULL,
    "saldoPendiente" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoCredito" NOT NULL DEFAULT 'PENDIENTE',
    "descripcion" VARCHAR(400),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abono" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "creditoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(14,2) NOT NULL,
    "saldoAnterior" DECIMAL(14,2) NOT NULL,
    "saldoNuevo" DECIMAL(14,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "referenciaPago" VARCHAR(100),
    "descripcion" VARCHAR(400),

    CONSTRAINT "Abono_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_usuarioId_key" ON "SuperAdmin"("usuarioId");

-- CreateIndex
CREATE INDEX "DocumentoLegal_tipo_activo_idx" ON "DocumentoLegal"("tipo", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoLegal_tipo_version_key" ON "DocumentoLegal"("tipo", "version");

-- CreateIndex
CREATE INDEX "AceptacionLegal_empresaId_idx" ON "AceptacionLegal"("empresaId");

-- CreateIndex
CREATE INDEX "AceptacionLegal_usuarioId_idx" ON "AceptacionLegal"("usuarioId");

-- CreateIndex
CREATE INDEX "AceptacionLegal_documentoId_idx" ON "AceptacionLegal"("documentoId");

-- CreateIndex
CREATE UNIQUE INDEX "AceptacionLegal_empresaId_id_key" ON "AceptacionLegal"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_nombre_key" ON "Plan"("nombre");

-- CreateIndex
CREATE INDEX "Empresa_estado_idx" ON "Empresa"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Secuencia_empresaId_tipo_key" ON "Secuencia"("empresaId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Secuencia_empresaId_id_key" ON "Secuencia"("empresaId", "id");

-- CreateIndex
CREATE INDEX "Suscripcion_empresaId_estado_idx" ON "Suscripcion"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Suscripcion_planId_idx" ON "Suscripcion"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Suscripcion_empresaId_id_key" ON "Suscripcion"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_empresaId_nombre_key" ON "Rol"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_empresaId_id_key" ON "Rol"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_rolId_idx" ON "Usuario"("empresaId", "rolId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_empresaId_id_key" ON "Usuario"("empresaId", "id");

-- CreateIndex
CREATE INDEX "Categoria_empresaId_nombre_idx" ON "Categoria"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "Categoria_padreId_idx" ON "Categoria"("padreId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_empresaId_id_key" ON "Categoria"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadMedida_empresaId_nombre_key" ON "UnidadMedida"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadMedida_empresaId_id_key" ON "UnidadMedida"("empresaId", "id");

-- CreateIndex
CREATE INDEX "Producto_empresaId_categoriaId_idx" ON "Producto"("empresaId", "categoriaId");

-- CreateIndex
CREATE INDEX "Producto_empresaId_activo_idx" ON "Producto"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_empresaId_sku_key" ON "Producto"("empresaId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_empresaId_codigoBarras_key" ON "Producto"("empresaId", "codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_empresaId_id_key" ON "Producto"("empresaId", "id");

-- CreateIndex
CREATE INDEX "Proveedor_empresaId_nombre_idx" ON "Proveedor"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_empresaId_id_key" ON "Proveedor"("empresaId", "id");

-- CreateIndex
CREATE INDEX "Cliente_empresaId_nombre_idx" ON "Cliente"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_empresaId_tipoDocumento_numeroDocumento_key" ON "Cliente"("empresaId", "tipoDocumento", "numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_empresaId_id_key" ON "Cliente"("empresaId", "id");

-- CreateIndex
CREATE INDEX "SesionCaja_empresaId_estado_idx" ON "SesionCaja"("empresaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "SesionCaja_empresaId_id_key" ON "SesionCaja"("empresaId", "id");

-- CreateIndex
CREATE INDEX "Venta_empresaId_creadoEn_idx" ON "Venta"("empresaId", "creadoEn");

-- CreateIndex
CREATE INDEX "Venta_sesionCajaId_idx" ON "Venta"("sesionCajaId");

-- CreateIndex
CREATE INDEX "Venta_clienteId_idx" ON "Venta"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_empresaId_numeroFactura_key" ON "Venta"("empresaId", "numeroFactura");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_empresaId_id_key" ON "Venta"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_empresaId_clienteId_id_key" ON "Venta"("empresaId", "clienteId", "id");

-- CreateIndex
CREATE INDEX "DetalleVenta_ventaId_idx" ON "DetalleVenta"("ventaId");

-- CreateIndex
CREATE INDEX "DetalleVenta_productoId_idx" ON "DetalleVenta"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleVenta_empresaId_id_key" ON "DetalleVenta"("empresaId", "id");

-- CreateIndex
CREATE INDEX "OrdenCompra_empresaId_estado_idx" ON "OrdenCompra"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "OrdenCompra_proveedorId_idx" ON "OrdenCompra"("proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_empresaId_numeroOrden_key" ON "OrdenCompra"("empresaId", "numeroOrden");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_empresaId_id_key" ON "OrdenCompra"("empresaId", "id");

-- CreateIndex
CREATE INDEX "ItemOrdenCompra_ordenCompraId_idx" ON "ItemOrdenCompra"("ordenCompraId");

-- CreateIndex
CREATE INDEX "ItemOrdenCompra_productoId_idx" ON "ItemOrdenCompra"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemOrdenCompra_empresaId_id_key" ON "ItemOrdenCompra"("empresaId", "id");

-- CreateIndex
CREATE INDEX "MovimientoAlmacen_empresaId_productoId_creadoEn_idx" ON "MovimientoAlmacen"("empresaId", "productoId", "creadoEn");

-- CreateIndex
CREATE INDEX "MovimientoAlmacen_empresaId_tipo_idx" ON "MovimientoAlmacen"("empresaId", "tipo");

-- CreateIndex
CREATE INDEX "MovimientoAlmacen_ventaId_idx" ON "MovimientoAlmacen"("ventaId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoAlmacen_empresaId_id_key" ON "MovimientoAlmacen"("empresaId", "id");

-- CreateIndex
CREATE INDEX "Devolucion_empresaId_estado_idx" ON "Devolucion"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Devolucion_ventaId_idx" ON "Devolucion"("ventaId");

-- CreateIndex
CREATE UNIQUE INDEX "Devolucion_empresaId_id_key" ON "Devolucion"("empresaId", "id");

-- CreateIndex
CREATE INDEX "DetalleDevolucion_devolucionId_idx" ON "DetalleDevolucion"("devolucionId");

-- CreateIndex
CREATE INDEX "DetalleDevolucion_productoId_idx" ON "DetalleDevolucion"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "DetalleDevolucion_empresaId_id_key" ON "DetalleDevolucion"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Credito_ventaId_key" ON "Credito"("ventaId");

-- CreateIndex
CREATE INDEX "Credito_empresaId_estado_idx" ON "Credito"("empresaId", "estado");

-- CreateIndex
CREATE INDEX "Credito_clienteId_idx" ON "Credito"("clienteId");

-- CreateIndex
CREATE INDEX "Credito_fechaVencimiento_idx" ON "Credito"("fechaVencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "Credito_empresaId_id_key" ON "Credito"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Credito_empresaId_ventaId_key" ON "Credito"("empresaId", "ventaId");

-- CreateIndex
CREATE UNIQUE INDEX "Credito_empresaId_clienteId_ventaId_key" ON "Credito"("empresaId", "clienteId", "ventaId");

-- CreateIndex
CREATE INDEX "Abono_empresaId_fecha_idx" ON "Abono"("empresaId", "fecha");

-- CreateIndex
CREATE INDEX "Abono_creditoId_idx" ON "Abono"("creditoId");

-- CreateIndex
CREATE UNIQUE INDEX "Abono_empresaId_id_key" ON "Abono"("empresaId", "id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdmin" ADD CONSTRAINT "SuperAdmin_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AceptacionLegal" ADD CONSTRAINT "AceptacionLegal_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoLegal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AceptacionLegal" ADD CONSTRAINT "AceptacionLegal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AceptacionLegal" ADD CONSTRAINT "AceptacionLegal_empresaId_usuarioId_fkey" FOREIGN KEY ("empresaId", "usuarioId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Secuencia" ADD CONSTRAINT "Secuencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rol" ADD CONSTRAINT "Rol_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_rolId_fkey" FOREIGN KEY ("empresaId", "rolId") REFERENCES "Rol"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_empresaId_padreId_fkey" FOREIGN KEY ("empresaId", "padreId") REFERENCES "Categoria"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UnidadMedida" ADD CONSTRAINT "UnidadMedida_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_empresaId_categoriaId_fkey" FOREIGN KEY ("empresaId", "categoriaId") REFERENCES "Categoria"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_empresaId_unidadMedidaId_fkey" FOREIGN KEY ("empresaId", "unidadMedidaId") REFERENCES "UnidadMedida"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_empresaId_abiertoPorId_fkey" FOREIGN KEY ("empresaId", "abiertoPorId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_empresaId_cerradoPorId_fkey" FOREIGN KEY ("empresaId", "cerradoPorId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_empresaId_sesionCajaId_fkey" FOREIGN KEY ("empresaId", "sesionCajaId") REFERENCES "SesionCaja"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "Cliente"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_empresaId_usuarioId_fkey" FOREIGN KEY ("empresaId", "usuarioId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_empresaId_ventaId_fkey" FOREIGN KEY ("empresaId", "ventaId") REFERENCES "Venta"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_empresaId_productoId_fkey" FOREIGN KEY ("empresaId", "productoId") REFERENCES "Producto"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_empresaId_proveedorId_fkey" FOREIGN KEY ("empresaId", "proveedorId") REFERENCES "Proveedor"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_empresaId_usuarioId_fkey" FOREIGN KEY ("empresaId", "usuarioId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_empresaId_aprobadoPorId_fkey" FOREIGN KEY ("empresaId", "aprobadoPorId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ItemOrdenCompra" ADD CONSTRAINT "ItemOrdenCompra_empresaId_ordenCompraId_fkey" FOREIGN KEY ("empresaId", "ordenCompraId") REFERENCES "OrdenCompra"("empresaId", "id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ItemOrdenCompra" ADD CONSTRAINT "ItemOrdenCompra_empresaId_productoId_fkey" FOREIGN KEY ("empresaId", "productoId") REFERENCES "Producto"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MovimientoAlmacen" ADD CONSTRAINT "MovimientoAlmacen_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoAlmacen" ADD CONSTRAINT "MovimientoAlmacen_empresaId_productoId_fkey" FOREIGN KEY ("empresaId", "productoId") REFERENCES "Producto"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MovimientoAlmacen" ADD CONSTRAINT "MovimientoAlmacen_empresaId_proveedorId_fkey" FOREIGN KEY ("empresaId", "proveedorId") REFERENCES "Proveedor"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MovimientoAlmacen" ADD CONSTRAINT "MovimientoAlmacen_empresaId_ventaId_fkey" FOREIGN KEY ("empresaId", "ventaId") REFERENCES "Venta"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MovimientoAlmacen" ADD CONSTRAINT "MovimientoAlmacen_empresaId_devolucionId_fkey" FOREIGN KEY ("empresaId", "devolucionId") REFERENCES "Devolucion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MovimientoAlmacen" ADD CONSTRAINT "MovimientoAlmacen_empresaId_usuarioId_fkey" FOREIGN KEY ("empresaId", "usuarioId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_empresaId_ventaId_fkey" FOREIGN KEY ("empresaId", "ventaId") REFERENCES "Venta"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_empresaId_proveedorId_fkey" FOREIGN KEY ("empresaId", "proveedorId") REFERENCES "Proveedor"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_empresaId_usuarioId_fkey" FOREIGN KEY ("empresaId", "usuarioId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DetalleDevolucion" ADD CONSTRAINT "DetalleDevolucion_empresaId_devolucionId_fkey" FOREIGN KEY ("empresaId", "devolucionId") REFERENCES "Devolucion"("empresaId", "id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DetalleDevolucion" ADD CONSTRAINT "DetalleDevolucion_empresaId_productoId_fkey" FOREIGN KEY ("empresaId", "productoId") REFERENCES "Producto"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "Cliente"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_empresaId_clienteId_ventaId_fkey" FOREIGN KEY ("empresaId", "clienteId", "ventaId") REFERENCES "Venta"("empresaId", "clienteId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_empresaId_creditoId_fkey" FOREIGN KEY ("empresaId", "creditoId") REFERENCES "Credito"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Abono" ADD CONSTRAINT "Abono_empresaId_usuarioId_fkey" FOREIGN KEY ("empresaId", "usuarioId") REFERENCES "Usuario"("empresaId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;
