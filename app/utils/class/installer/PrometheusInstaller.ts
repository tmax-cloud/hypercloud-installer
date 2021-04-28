/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import YAML from 'yaml';
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';
import GrafanaInstaller from './GrafanaInstaller';

export default class PrometheusInstaller extends AbstractInstaller {
  public static readonly DIR = `install-prometheus`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${PrometheusInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${PrometheusInstaller.INSTALL_HOME}/image`;

  public static readonly PROMETHEUS_VERSION = `2.11.0`;

  public static readonly PROMETHEUS_OPERATOR_VERSION = `0.34.0`;

  public static readonly NODE_EXPORTER_VERSION = `0.18.1`;

  public static readonly KUBE_STATE_METRICS_VERSION = `1.8.0`;

  public static readonly CONFIGMAP_RELOADER_VERSION = `0.34.0`;

  public static readonly CONFIGMAP_RELOAD_VERSION = `0.0.1`;

  public static readonly KUBE_RBAC_PROXY_VERSION = `0.4.1`;

  public static readonly PROMETHEUS_ADAPTER_VERSION = `0.5.0`;

  public static readonly ALERTMANAGER_VERSION = `0.20.0`;

  public static readonly GRAFANA_VERSION = `6.4.3`;

  // singleton
  private static instance: PrometheusInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!PrometheusInstaller.instance) {
      PrometheusInstaller.instance = new PrometheusInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: {
    state: any;
    callback: any;
    setProgress: Function;
  }) {
    const { state, callback, setProgress } = param;

    setProgress(10);
    await this.preWorkInstall({
      callback
    });

    await this._installMainMaster(state, callback);
    setProgress(60);

    // grafana 설치
    const grafanaInstaller = GrafanaInstaller.getInstance;
    grafanaInstaller.env = this.env;
    await grafanaInstaller.install({
      callback
    });
    setProgress(100);
  }

  public async remove() {
    // grafana 삭제
    const grafanaInstaller = GrafanaInstaller.getInstance;
    grafanaInstaller.env = this.env;
    await grafanaInstaller.remove();

    await this._removeMainMaster();
  }

  // protected abstract 구현
  protected async preWorkInstall(param: { callback: any }) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
    // await this._copyFile(callback);
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      // await this.downloadImageFile();
      // await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      // await this.registryWork({
      //   callback
      // });
    }

    console.debug('###### Finish pre-installation... ######');
  }

  // protected async downloadImageFile() {
  //   // TODO: download image file
  //   console.debug(
  //     '@@@@@@ Start downloading the image file to client local... @@@@@@'
  //   );
  //   console.debug(
  //     '###### Finish downloading the image file to client local... ######'
  //   );
  // }

  // protected async sendImageFile() {
  //   console.debug(
  //     '@@@@@@ Start sending the image file to main master node... @@@@@@'
  //   );
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${PrometheusInstaller.DIR}/`;
  //   await scp.sendFile(
  //     mainMaster,
  //     srcPath,
  //     `${PrometheusInstaller.IMAGE_HOME}/`
  //   );
  //   console.debug(
  //     '###### Finish sending the image file to main master node... ######'
  //   );
  // }

  protected downloadGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected sendGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected async cloneGitFile(callback: any) {
    console.debug('@@@@@@ Start clone the GIT file at each node... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = script.cloneGitFile(
      CONST.PROMETHEUS_REPO,
      CONST.GIT_BRANCH
    );
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  // protected async registryWork(param: { callback: any }) {
  //   console.debug(
  //     '@@@@@@ Start pushing the image at main master node... @@@@@@'
  //   );
  //   const { callback } = param;
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = this.getImagePushScript();
  //   mainMaster.cmd += this._getImagePathEditScript();
  //   await mainMaster.exeCmd(callback);
  //   console.debug(
  //     '###### Finish pushing the image at main master node... ######'
  //   );
  // }

  // protected getImagePushScript(): string {
  //   let gitPullCommand = `
  //     mkdir -p ~/${PrometheusInstaller.IMAGE_HOME};
  //     export PROMETHEUS_HOME=~/${PrometheusInstaller.IMAGE_HOME};
  //     export PROMETHEUS_VERSION=v${PrometheusInstaller.PROMETHEUS_VERSION};
  //     export PROMETHEUS_OPERATOR_VERSION=v${PrometheusInstaller.PROMETHEUS_OPERATOR_VERSION};
  //     export NODE_EXPORTER_VERSION=v${PrometheusInstaller.NODE_EXPORTER_VERSION};
  //     # export GRAFANA_VERSION=${PrometheusInstaller.GRAFANA_VERSION};
  //     export KUBE_STATE_METRICS_VERSION=v${PrometheusInstaller.KUBE_STATE_METRICS_VERSION};
  //     export CONFIGMAP_RELOADER_VERSION=v${PrometheusInstaller.CONFIGMAP_RELOADER_VERSION};
  //     export CONFIGMAP_RELOAD_VERSION=v${PrometheusInstaller.CONFIGMAP_RELOAD_VERSION};
  //     export KUBE_RBAC_PROXY_VERSION=v${PrometheusInstaller.KUBE_RBAC_PROXY_VERSION};
  //     export PROMETHEUS_ADAPTER_VERSION=v${PrometheusInstaller.PROMETHEUS_ADAPTER_VERSION};
  //     export ALERTMANAGER_VERSION=v${PrometheusInstaller.ALERTMANAGER_VERSION};
  //     export REGISTRY=${this.env.registry};
  //     cd $PROMETHEUS_HOME;
  //     `;
  //   if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
  //     gitPullCommand += `
  //       sudo docker load < prometheus-prometheus_\${PROMETHEUS_VERSION}.tar;
  //       sudo docker load < prometheus-operator_\${PROMETHEUS_OPERATOR_VERSION}.tar;
  //       sudo docker load < node-exporter_\${NODE_EXPORTER_VERSION}.tar;
  //       # sudo docker load < grafana_\${GRAFANA_VERSION}.tar;
  //       sudo docker load < kube-state-metrics_\${KUBE_STATE_METRICS_VERSION}.tar;
  //       sudo docker load < config-reloader_\${CONFIGMAP_RELOADER_VERSION}.tar;
  //       sudo docker load < config-reload_\${CONFIGMAP_RELOAD_VERSION}.tar;
  //       sudo docker load < kube-rbac-proxy_\${KUBE_RBAC_PROXY_VERSION}.tar;
  //       sudo docker load < prometheus-adapter_\${PROMETHEUS_ADAPTER_VERSION}.tar;
  //       sudo docker load < alertmanager_\${ALERTMANAGER_VERSION}.tar;
  //       `;
  //   } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
  //     gitPullCommand += `
  //       sudo docker pull quay.io/prometheus/prometheus:\${PROMETHEUS_VERSION};
  //       sudo docker pull quay.io/coreos/prometheus-operator:\${PROMETHEUS_OPERATOR_VERSION};
  //       sudo docker pull quay.io/prometheus/node-exporter:\${NODE_EXPORTER_VERSION};
  //       # sudo docker pull grafana/grafana:\${GRAFANA_VERSION};
  //       sudo docker pull quay.io/coreos/kube-state-metrics:\${KUBE_STATE_METRICS_VERSION};
  //       sudo docker pull quay.io/coreos/prometheus-config-reloader:\${CONFIGMAP_RELOADER_VERSION};
  //       sudo docker pull quay.io/coreos/configmap-reload:\${CONFIGMAP_RELOAD_VERSION};
  //       sudo docker pull quay.io/coreos/kube-rbac-proxy:\${KUBE_RBAC_PROXY_VERSION};
  //       sudo docker pull quay.io/coreos/k8s-prometheus-adapter-amd64:\${PROMETHEUS_ADAPTER_VERSION};
  //       sudo docker pull quay.io/prometheus/alertmanager:\${ALERTMANAGER_VERSION};
  //       `;
  //   }
  //   return `
  //       ${gitPullCommand}
  //       sudo docker tag quay.io/prometheus/prometheus:\${PROMETHEUS_VERSION} \${REGISTRY}/prometheus/prometheus:\${PROMETHEUS_VERSION};
  //       sudo docker tag quay.io/coreos/prometheus-operator:\${PROMETHEUS_OPERATOR_VERSION} \${REGISTRY}/coreos/prometheus-operator:\${PROMETHEUS_OPERATOR_VERSION};
  //       sudo docker tag quay.io/prometheus/node-exporter:\${NODE_EXPORTER_VERSION} \${REGISTRY}/prometheus/node-exporter:\${NODE_EXPORTER_VERSION};
  //       # sudo docker tag grafana/grafana:\${GRAFANA_VERSION} \${REGISTRY}/grafana:\${GRAFANA_VERSION};
  //       sudo docker tag quay.io/coreos/kube-state-metrics:\${KUBE_STATE_METRICS_VERSION} \${REGISTRY}/coreos/kube-state-metrics:\${KUBE_STATE_METRICS_VERSION};
  //       sudo docker tag quay.io/coreos/prometheus-config-reloader:\${CONFIGMAP_RELOADER_VERSION} \${REGISTRY}/coreos/prometheus-config-reloader:\${CONFIGMAP_RELOADER_VERSION};
  //       sudo docker tag quay.io/coreos/configmap-reload:\${CONFIGMAP_RELOAD_VERSION} \${REGISTRY}/coreos/configmap-reload:\${CONFIGMAP_RELOAD_VERSION};
  //       sudo docker tag quay.io/coreos/kube-rbac-proxy:\${KUBE_RBAC_PROXY_VERSION} \${REGISTRY}/coreos/kube-rbac-proxy:\${KUBE_RBAC_PROXY_VERSION};
  //       sudo docker tag quay.io/coreos/k8s-prometheus-adapter-amd64:\${PROMETHEUS_ADAPTER_VERSION} \${REGISTRY}/coreos/k8s-prometheus-adapter-amd64:\${PROMETHEUS_ADAPTER_VERSION};
  //       sudo docker tag quay.io/prometheus/alertmanager:\${ALERTMANAGER_VERSION} \${REGISTRY}/prometheus/alertmanager:\${ALERTMANAGER_VERSION};

  //       sudo docker push \${REGISTRY}/prometheus/prometheus:\${PROMETHEUS_VERSION};
  //       sudo docker push \${REGISTRY}/coreos/prometheus-operator:\${PROMETHEUS_OPERATOR_VERSION};
  //       sudo docker push \${REGISTRY}/prometheus/node-exporter:\${NODE_EXPORTER_VERSION};
  //       # sudo docker push \${REGISTRY}/grafana:\${GRAFANA_VERSION};
  //       sudo docker push \${REGISTRY}/coreos/kube-state-metrics:\${KUBE_STATE_METRICS_VERSION};
  //       sudo docker push \${REGISTRY}/coreos/prometheus-config-reloader:\${CONFIGMAP_RELOADER_VERSION};
  //       sudo docker push \${REGISTRY}/coreos/configmap-reload:\${CONFIGMAP_RELOAD_VERSION};
  //       sudo docker push \${REGISTRY}/coreos/kube-rbac-proxy:\${KUBE_RBAC_PROXY_VERSION};
  //       sudo docker push \${REGISTRY}/coreos/k8s-prometheus-adapter-amd64:\${PROMETHEUS_ADAPTER_VERSION};
  //       sudo docker push \${REGISTRY}/prometheus/alertmanager:\${ALERTMANAGER_VERSION};
  //       #rm -rf $PROMETHEUS_HOME;
  //       `;
  // }

  /**
   * private 메서드
   */
  private async _installMainMaster(state: any, callback: any) {
    console.debug('@@@@@@ Start installing main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step 0. Prometheus Config 설정
    mainMaster.cmd = this._step0(state);
    await mainMaster.exeCmd(callback);

    // Step 1. installer 실행
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish installing main Master... ######');
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove main Master... ######');
  }

  private _step0(state: { version: string; pvcCapacity: string }): string {
    const { pvcCapacity } = state;
    // XXX: sed 부분 주석 처리, config 파일에 적힌 내용 sed하지 않음
    let script = `
      cd ~/${PrometheusInstaller.INSTALL_HOME};
      sudo sed -i 's|\\r$||g' version.conf;
      . version.conf;

      sudo sed -i "s|$PROMETHEUS_PVC|${pvcCapacity}Gi|g" ./version.conf;

      # sudo sed -i "s|$PROMETHEUS_VERSION|v${PrometheusInstaller.PROMETHEUS_VERSION}|g" ./version.conf;
      # sudo sed -i "s|$PROMETHEUS_OPERATOR_VERSION|v${PrometheusInstaller.PROMETHEUS_OPERATOR_VERSION}|g" ./version.conf;
      # sudo sed -i "s|$NODE_EXPORTER_VERSION|v${PrometheusInstaller.NODE_EXPORTER_VERSION}|g" ./version.conf;
      # sudo sed -i "s|$KUBE_STATE_METRICS_VERSION|v${PrometheusInstaller.KUBE_STATE_METRICS_VERSION}|g" ./version.conf;
      # sudo sed -i "s|$CONFIGMAP_RELOADER_VERSION|v${PrometheusInstaller.CONFIGMAP_RELOADER_VERSION}|g" ./version.conf;
      # sudo sed -i "s|$CONFIGMAP_RELOAD_VERSION|v${PrometheusInstaller.CONFIGMAP_RELOAD_VERSION}|g" ./version.conf;
      # sudo sed -i "s|$KUBE_RBAC_PROXY_VERSION|v${PrometheusInstaller.KUBE_RBAC_PROXY_VERSION}|g" ./version.conf;
      # sudo sed -i "s|$PROMETHEUS_ADAPTER_VERSION|v${PrometheusInstaller.PROMETHEUS_ADAPTER_VERSION}|g" ./version.conf;
      # sudo sed -i "s|$ALERTMANAGER_VERSION|v${PrometheusInstaller.ALERTMANAGER_VERSION}|g" ./version.conf;
    `;

    if (this.env.registry) {
      script += `sudo sed -i "s|$REGISTRY|${this.env.registry}|g" ./version.conf;`;
    }

    return script;
  }

  private _step1(): string {
    // FIXME: 추후 storageclass name sed 부분 제거 해야함
    return `
      cd ~/${PrometheusInstaller.INSTALL_HOME};
      sudo sed -i "s|csi-rbd-sc|csi-cephfs-sc|g" yaml/manifests/prometheus-prometheus.yaml;
      sudo chmod +x install.sh;
      ./install.sh;
      `;
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${PrometheusInstaller.INSTALL_HOME};
    sudo chmod +x uninstall.sh;
    ./uninstall.sh;
    rm -rf ~/${PrometheusInstaller.INSTALL_HOME};
    `;
  }

  // private _getImagePathEditScript(): string {
  //   // git guide에 내용 보기 쉽게 변경해놓음 (공백 유지해야함)
  //   return `
  //   cd ~/${PrometheusInstaller.INSTALL_HOME}/manifest/manifests/;
  //   sed -i "s| quay.io/prometheus/alertmanager| ${this.env.registry}/prometheus/alertmanager|g" alertmanager-alertmanager.yaml;
  //   # sed -i "s| grafana/grafana| ${this.env.registry}/grafana|g" grafana-deployment.yaml;
  //   sed -i "s| quay.io/coreos/kube-rbac-proxy| ${this.env.registry}/coreos/kube-rbac-proxy|g" kube-state-metrics-deployment.yaml;
  //   sed -i "s| quay.io/coreos/kube-state-metrics| ${this.env.registry}/coreos/kube-state-metrics|g" kube-state-metrics-deployment.yaml;
  //   sed -i "s| quay.io/prometheus/node-exporter| ${this.env.registry}/prometheus/node-exporter|g" node-exporter-daemonset.yaml;
  //   sed -i "s| quay.io/coreos/kube-rbac-proxy| ${this.env.registry}/coreos/kube-rbac-proxy|g" node-exporter-daemonset.yaml;
  //   sed -i "s| quay.io/coreos/k8s-prometheus-adapter-amd64| ${this.env.registry}/coreos/k8s-prometheus-adapter-amd64|g" prometheus-adapter-deployment.yaml;
  //   sed -i "s| quay.io/prometheus/prometheus| ${this.env.registry}/prometheus/prometheus|g" prometheus-prometheus.yaml;

  //   cd ~/${PrometheusInstaller.INSTALL_HOME}/manifest/setup/;
  //   sed -i "s| quay.io/coreos/configmap-reload| ${this.env.registry}/coreos/configmap-reload|g" prometheus-operator-deployment.yaml
  //   sed -i "s| quay.io/coreos/prometheus-config-reloader| ${this.env.registry}/coreos/prometheus-config-reloader|g" prometheus-operator-deployment.yaml
  //   sed -i "s| quay.io/coreos/prometheus-operator| ${this.env.registry}/coreos/prometheus-operator|g" prometheus-operator-deployment.yaml
  //   `;
  // }
}
