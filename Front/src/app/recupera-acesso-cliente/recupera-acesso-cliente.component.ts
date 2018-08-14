import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';

import { BnAlertsService } from 'bndes-ux4';

import { Cliente } from './Cliente';
import { PessoaJuridicaService } from '../pessoa-juridica.service';
import { Web3Service } from './../Web3Service';


@Component({
  selector: 'app-recupera-conta-cliente',
  templateUrl: './recupera-acesso-cliente.component.html',
  styleUrls: ['./recupera-acesso-cliente.component.css']
})
export class RecuperaAcessoClienteComponent implements OnInit {

  cliente: Cliente;
  statusHabilitacaoForm: boolean;
  subcreditoSelecionado: number;
  contaBlockchainAssociada: string;

  file: any = null;

  declaracao: string
  declaracaoAssinada: string

  contaEstaValida: boolean

  constructor(private pessoaJuridicaService: PessoaJuridicaService, protected bnAlertsService: BnAlertsService,
    private web3Service: Web3Service, private ref: ChangeDetectorRef, private zone: NgZone) { }

  ngOnInit() {
    this.mudaStatusHabilitacaoForm(true);
    this.inicializaPessoaJuridica();
  }

  inicializaPessoaJuridica() {
    this.cliente = new Cliente();
    this.cliente.id = 0;
    this.cliente.cnpj = "";
    this.cliente.dadosCadastrais = undefined;
    this.cliente.subcreditos = undefined;
  }

  refreshContaBlockchainSelecionada() {
    this.recuperaContaSelecionada();
  }

  uploadArquivo(idElemento: string) {
    this.file = (<HTMLInputElement>document.getElementById(idElemento)).files[0];

    var fileReader = new FileReader();
    fileReader.readAsText(this.file, "UTF-8");

    return fileReader;
  }

  carregaCertificadoDigital($event): void {
    let self = this;

    var fileReader = this.uploadArquivo("certificado");

    fileReader.onload = function (e) {
      self.cliente.cnpj = fileReader.result
      self.recuperaClientePorCNPJ(self.cliente.cnpj.trim())
    }
  }

  receberDeclaracaoAssinada(declaracaoAssinadaRecebida) {
    console.log(declaracaoAssinadaRecebida)

    this.declaracaoAssinada = declaracaoAssinadaRecebida
  }

  cancelar() {
    this.cliente.dadosCadastrais = undefined
  }

  mudaStatusHabilitacaoForm(statusForm: boolean) {
    this.statusHabilitacaoForm = statusForm;
  }

  recuperaContaSelecionada() {
    let contaSelecionada = this.web3Service.recuperaContaSelecionada()

    this.verificaContaBlockchainSelecionada(contaSelecionada)

    return contaSelecionada
  }

  verificaContaBlockchainSelecionada(contaBlockchainSelecionada) {
    this.web3Service.accountIsActive(contaBlockchainSelecionada,
      result => {

        if(result) {
          this.contaEstaValida = false 
        } else {
          this.contaEstaValida = true
        }
        this.ref.detectChanges()

      },
      error => {
        console.error("Erro ao verificar o estado da conta")
      }
    )
  }

  recuperaClientePorCNPJ(cnpj) {

    console.log("RECUPERA CLIENTE com CNPJ = " + cnpj);

    this.pessoaJuridicaService.recuperaEmpresaPorCnpj(cnpj).subscribe(
      empresa => {
        if (empresa) {
          console.log("empresa encontrada - ");
          console.log(empresa);

          let subcreditos = new Array()

          for (var i = 0; i < empresa["subcreditos"].length; i++) {
            if (empresa["subcreditos"][i].papel === "cliente" && empresa["subcreditos"][i].isActive && empresa["subcreditos"][i].contaBlockchain !== "")
              subcreditos.push(empresa["subcreditos"][i]);
          }

          this.cliente.id = empresa["_id"];
          this.cliente.dadosCadastrais = empresa["dadosCadastrais"];
          this.cliente.subcreditos = JSON.parse(JSON.stringify(subcreditos))

          this.declaracao = "Declaro que sou a empresa de Razão Social " + this.cliente.dadosCadastrais.razaoSocial + " com o CNPJ " + this.cliente.cnpj
        }
        else {
          console.log("nenhuma empresa encontrada");
        }
      },
      error => {
        console.log("Erro ao buscar dados da empresa");
        this.inicializaPessoaJuridica();
      });

  }

  recuperaContaBlockchainAssociada() {

    console.log("RECUPERA Conta Blockchain associada ao subcrédito");
    console.log(this.subcreditoSelecionado);

    var i = 0;

    for (i = 0; this.cliente.subcreditos[i]; i++) {
      if (this.cliente.subcreditos[i].numero == this.subcreditoSelecionado) {
        this.contaBlockchainAssociada = this.cliente.subcreditos[i].contaBlockchain;
      }
    }

    console.log(this.contaBlockchainAssociada);
  }

  cancelaAssociacaoContaCliente() {

    let self = this;
    let contaBlockchain = this.recuperaContaSelecionada();

    if (self.contaBlockchainAssociada === "" || self.contaBlockchainAssociada === undefined) {
      console.log("O subcrédito selecionado não possui conta blockchain associada")

      let msg = "O subcrédito selecionado não possui conta blockchain associada"
      self.bnAlertsService.criarAlerta("error", "Erro", msg, 2);
    } else {

      self.web3Service.cancelarAssociacaoDeConta(parseInt(self.cliente.cnpj), self.subcreditoSelecionado, 0, false,

        function (txHash) {
          let s = "Troca de conta do cnpj " + self.cliente.cnpj + "  enviada. Aguarde a confirmação.";
          self.bnAlertsService.criarAlerta("info", "Sucesso", s, 5);
          console.log(s);

          self.web3Service.registraWatcherEventosLocal(txHash, function (error, result) {
            if (!error) {
              let s = "A associação foi confirmada na blockchain.";
              self.bnAlertsService.criarAlerta("info", "Sucesso", s, 5);
              console.log(s);

              console.log("Início da gravação no BD");

              self.pessoaJuridicaService.trocarContaCliente(self.cliente, self.subcreditoSelecionado, contaBlockchain).subscribe(
                data => {
                  console.log("PJ alterada no mongo - ")
                  
                  self.inicializaPessoaJuridica()
                  self.mudaStatusHabilitacaoForm(true)
                  self.ref.detectChanges()
                },
                error => {
                  let s = "Não foi possível realizar atualização no banco de dados, embora os dados tenham sido cadastrados na blockchain"
                  self.bnAlertsService.criarAlerta("error", "Erro", s, 5)
                  console.log(s + error)
                  self.mudaStatusHabilitacaoForm(true)
                }
              );

              console.log("Fim da gravação no BD");

              self.zone.run(() => { });
            }
            else {
              console.log(error);
            }
          });
        },
        function (error) {

          let s = "Erro ao cadastrar na blockchain\nUma possibilidade é você já ter se registrado utilizando essa conta ethereum."
          self.bnAlertsService.criarAlerta("error", "Erro", s, 5)
          console.log(s)
          console.log(error)
          self.mudaStatusHabilitacaoForm(true);
        })
    }

  }

}
